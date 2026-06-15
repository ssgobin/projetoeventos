import { getAdmin, response } from "./_admin";
import { sendScheduledEmail } from "./_invite";
import type { ScheduledEmailKind } from "./_email";

export const config = {
  schedule: "@hourly",
};

type DueEmail = {
  kind: ScheduledEmailKind;
  event: FirebaseFirestore.QueryDocumentSnapshot;
};

function toDate(value: FirebaseFirestore.Timestamp | undefined) {
  return value?.toDate?.() || new Date(0);
}

function dueInWindow(dueAt: number, now: number, windowMs = 2 * 60 * 60 * 1000) {
  return dueAt <= now && dueAt > now - windowMs;
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dueEmailsForEvent(event: FirebaseFirestore.QueryDocumentSnapshot, nowDate: Date): DueEmail[] {
  const data = event.data();
  const agenda = data.emailAgenda || {};
  const eventDate = toDate(data.dataEvento);
  const eventTime = eventDate.getTime();
  const now = nowDate.getTime();
  const due: DueEmail[] = [];

  if (agenda.conviteAtivo !== false && eventTime > now) {
    due.push({ kind: "convite", event });
  }
  if (agenda.lembrete24hAtivo !== false && dueInWindow(eventTime - 24 * 60 * 60 * 1000, now)) {
    due.push({ kind: "lembrete24h", event });
  }
  if (agenda.lembreteDiaAtivo !== false && eventTime > now && dayKey(eventDate) === dayKey(nowDate)) {
    due.push({ kind: "lembreteDia", event });
  }
  if (agenda.posEventoAtivo === true) {
    const hoursAfter = Number(agenda.posEventoHorasDepois || 2);
    if (dueInWindow(eventTime + hoursAfter * 60 * 60 * 1000, now, 6 * 60 * 60 * 1000)) {
      due.push({ kind: "posEvento", event });
    }
  }

  return due;
}

function shouldSend(kind: ScheduledEmailKind, signup: FirebaseFirestore.DocumentData) {
  if (!signup.email) return false;
  if (signup.emailAgendados?.[kind]?.status === "enviado") return false;
  if (kind === "convite") return signup.emailEnviado !== true;
  if (signup.statusInscricao === "espera") return false;
  if (kind === "posEvento") return signup.checkin?.realizado === true;
  return true;
}

export async function handler() {
  const admin = getAdmin();
  const db = admin.firestore();
  const now = new Date();
  const from = admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000));
  const to = admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 26 * 60 * 60 * 1000));

  const eventsSnap = await db.collection("eventos")
    .where("dataEvento", ">=", from)
    .where("dataEvento", "<=", to)
    .limit(150)
    .get();

  const summary = {
    eventos: eventsSnap.size,
    processados: 0,
    enviados: 0,
    ignorados: 0,
    falhas: 0,
  };

  for (const eventDoc of eventsSnap.docs) {
    const event = eventDoc.data();
    if (event.status === "inativo") continue;

    const dueEmails = dueEmailsForEvent(eventDoc, now);
    for (const due of dueEmails) {
      let query: FirebaseFirestore.Query = db.collection("inscricoes").where("eventoId", "==", due.event.id);
      if (due.kind === "convite") query = query.where("emailEnviado", "==", false);
      const signupsSnap = await query.limit(300).get();
      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const signupDoc of signupsSnap.docs) {
        const signup = signupDoc.data();
        if (!shouldSend(due.kind, signup)) {
          skipped += 1;
          continue;
        }
        const result = await sendScheduledEmail(db, admin, signupDoc.ref, due.kind);
        summary.processados += 1;
        if (result.ok && "skipped" in result) {
          skipped += 1;
        } else if (result.ok) {
          sent += 1;
          summary.enviados += 1;
        } else {
          failed += 1;
          summary.falhas += 1;
        }
      }

      summary.ignorados += skipped;
      if (sent || failed) {
        await db.collection("logs").add({
          empresaId: event.empresaId,
          usuarioId: "scheduled-emails",
          acao: `email_agendado_${due.kind}`,
          detalhes: { eventoId: due.event.id, enviados: sent, ignorados: skipped, falhas: failed },
          dataHora: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  return response(200, summary);
}
