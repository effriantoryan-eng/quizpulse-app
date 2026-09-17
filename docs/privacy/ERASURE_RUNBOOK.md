# Erasure runbook (owner-only)

_How to action a data-erasure request. This is operator procedure for the QuizPulse owner. The
in-app tools it describes are at **Admin portal → Erasure**, and every action they take is written
to the append-only `audit_log`. Introduced v4.11.0 (R2)._

Two kinds of request are covered:

- **A student (or their parent/school) asks to erase one child's data.** → the device erasure tool.
- **A teacher asks to delete their account.** Teachers can do this themselves in-app
  (**Your account → Delete my account**); the owner tool is for when they ask you to do it for them.

Both are **irreversible**. Both require a **fresh sign-in** (step-up re-auth, 10-minute window) and
record a fail-closed `privacy.erasure.requested` audit entry *before* anything is deleted.

---

## 1. Verify the requester first

Never erase on an unverified request. Confirm the requester is who they say they are:

- **Student / parent request:** action it **through the school**, not directly with the child.
  Confirm the request came from, or was endorsed by, the teacher or school that runs the class. The
  school holds the relationship with the family; QuizPulse does not.
- **Teacher request:** confirm it came from the **teacher's own account email** (the address shown on
  their teacher record, visible in **Admin portal → Teachers → the teacher**). A request from any
  other address is not sufficient on its own.

Record the reference you verified against (an email address or a ticket number). You will type it
into the tool's **Request reference** field, and it is stored on the audit entry.

---

## 2. Find the record

Open **Admin portal → Erasure**.

**For a device (one student):**
1. Search for the teacher who runs the class (name, email, or id).
2. Select the teacher, then pick the **class** the student is in.
3. The candidates table lists that class's join requests: student name, status, join date and the
   device id. Identify the right row. If you are unsure which device is the student's, cross-check
   the name and join date with what the school gave you before proceeding.

**For a teacher account:**
1. Search for and select the teacher.
2. Use the **Delete this whole teacher account** panel.

---

## 3. Run the erasure

**Device erasure** removes, for that one device, everything that ties data to the child, across
**every** class the device joined (not only the class you searched from):

- their quiz answers (hard-deleted — not de-identified, because this is an explicit erasure request),
- their push-notification sign-up,
- their join requests (any status), and
- their page-view telemetry.

Approved-class student counts are decremented and any queued join request is promoted, exactly as a
normal removal.

Steps: click **Erase this student's data** on the row → the modal shows the name and class → type the
**Request reference** → **Erase this data**. If you are prompted to sign in again, do so (the token
must be under 10 minutes old) and retry. On success the tool shows the per-container counts removed.

**Teacher account deletion** removes the teacher document last, after cascading: their classes (and
each class's students' names, sign-ups and de-identified answers), their quizzes and **every** answer
to them, their questions, upvotes and reports, their drafts and uploaded sources, and their school
**only if** it is unvalidated and no other teacher belongs to it. Copies other teachers made of this
teacher's shared questions stay with those teachers.

Steps: type the **Request reference** in the panel → **Delete this teacher's account** → confirm the
browser prompt. Re-auth if asked. On success the tool shows the counts removed.

> The **Entra sign-in account is NOT deleted by these tools** (D2.3). The completed audit entry
> records `identityDeletion: 'manual-pending'` to flag that the sign-in identity still needs the
> manual step in section 4. Until that step is done, the person could still sign in — they would land
> on onboarding as a brand-new teacher, because their teacher record is gone.

---

## 4. Delete the Entra sign-in account (manual, teacher deletions only)

This step is only needed for a **teacher account** deletion (students never have a sign-in account).
Do it in the Microsoft Entra admin center, on the CIAM tenant (`quizpulseid.onmicrosoft.com`):

1. Sign in to <https://entra.microsoft.com> with a directory admin account for the CIAM tenant.
2. **Identity → Users → All users**.
3. Search for the teacher by the email you verified in section 1.
4. Open the user, confirm it is the right person, then **Delete user**.
5. The user moves to **Deleted users** for 30 days before permanent removal; you may **permanently
   delete** it there if the request requires immediate erasure of the sign-in identity.

Do not automate this. Microsoft Graph automation would need `User.ReadWrite.All` on the CIAM tenant,
which is out of scope for R2 (tracked as a possible future sprint).

---

## 5. Confirm and reply

Completion is proven by the audit trail: open **Admin portal → Audit Log** and filter for the
`privacy.erasure.requested` and `privacy.erasure.completed` entries (or, for a self-service teacher
deletion, `account.deletion.requested` / `account.deleted`). The completed entry carries the counts
removed and the request reference you entered.

Reply template:

> Subject: Your QuizPulse data erasure request
>
> Hi [name],
>
> We have completed your request to erase [the student's data in class “[class]” / your QuizPulse
> account], received on [date] (reference [ref]).
>
> [For a device:] All of that device's quiz answers, notification sign-up, join requests and page-view
> records have been permanently deleted from QuizPulse.
> [For a teacher account:] Your classes, quizzes, every student answer, your questions, drafts and
> uploaded materials have been permanently deleted. Your sign-in account has [also been removed /
> been scheduled for removal].
>
> This action is complete and cannot be undone. If you have any questions, just reply to this email.
>
> [your name], QuizPulse

Keep the correspondence and the reference with your records. The audit entries are retained (the
`audit_log` is append-only and is deliberately never touched by any erasure).
