# Riaya — Actors & Use Cases

## Doctor

### Register and apply for verification
- Create an account with email OTP.
- Submit professional and cabinet details (identity documents, Medical Council info, speciality, location on map, etc.).
- **Precondition:** none (new doctor).
- **Postcondition:** account exists; status pending review; only profile completion is available until approved.
- **Alternative flow — rejection:** if an administrator rejects the application (optionally with reasons), the doctor remains limited to the profile, corrects the information, and **reapplies**. The application returns to pending review.

### Manage practice profile and availability
- Update cabinet / professional information after approval (as allowed by the product).
- Set weekly working hours used when patients book via AI.
- **Precondition:** account verified.

### Manage patients
- Create and update patient records.
- Attach patients created from AI bookings when accepting a pending appointment.
- **Precondition:** account verified.

### Manage appointments
- Create, move, edit, or cancel appointments on the practice calendar.
- Accept a pending AI booking (optionally link/create patient) → confirmed; WhatsApp confirmation may be sent.
- Decline a pending AI booking → cancelled.
- Accept an **urgent** pending request → keep that booking; sibling urgent requests for other doctors are cancelled.
- **Precondition:** account verified.
- **Notes:** new AI requests appear in real time; urgent requests are visually marked.

### Manage medical documentation
- Create consultation notes, prescriptions, and other medical files; attach documents.
- Send medical documents to a patient via WhatsApp.
- **Precondition:** account verified; WhatsApp send requires a linked WhatsApp session and available plan quota (Free).

### Manage patient billing
- Create invoices, record payments, cancel invoices as needed.
- Send an invoice PDF to the patient via WhatsApp.
- **Precondition:** account verified; WhatsApp send requires linked WhatsApp and quota.

### Record and transcribe consultations
- Record a conversation with a patient.
- Generate a transcript from a recording.
- **Precondition:** account verified; Free plan enforces monthly recording limits.

### Use the practice AI assistant
- Ask how to use Riaya and what is allowed under the current plan.
- Ask medical questions.
- Attach a recording transcript and ask questions about it.
- **Precondition:** account verified; Free plan enforces monthly AI message limits.

### Connect WhatsApp
- Link a personal WhatsApp number by scanning a QR code so outbound messages to patients use that number.
- **Precondition:** account verified.

### Manage Riaya subscription
- View Free vs Pro limits and current usage.
- Upgrade / pay recurring Riaya invoices (Konnect) to keep Pro active.
- **Precondition:** account verified.

---

## Administrator

### Review and verify doctors
- Browse and search doctor applications and profiles.
- Approve or reject a doctor application (rejection may include reasons shown to the doctor).
- **Postcondition (approve):** doctor gains full dashboard access.
- **Postcondition (reject):** doctor can update their profile and reapply.

### Monitor the AI booking channel
- Observe live patient–AI calls and conversation transcripts.
- Inspect best-fit results (speciality, location, time) for operations / debugging.

### Operate platform configuration
- Manage platform-level data exposed in admin (e.g. users, specialities, settings).
- Link admin WhatsApp for platform outbound messages (timeouts / reviews when routed that way).

### View platform overview
- Consult aggregate stats on doctors, appointments, and calls.

---

## Patient

Patients have no account. Identity is the calling phone number. Channel: phone call + WhatsApp.

### Call Riaya and speak with the booking assistant
- Reach the AI in English, French, or Tunisian Arabic.
- Change preferred language for this and future interactions.
- **Constraint:** the assistant does not give medical advice.

### Book an appointment
- Provide name (if unknown), reason or speciality, location, and preferred time.
- Choose among best-fit doctors (distance + availability within ~50 km in Tunisia).
- **Postcondition:** a **pending** appointment is created for the selected doctor.
- **Failure:** slot conflict, doctor unavailable, or Free-plan AI booking limit for that doctor → offered another option.

### Request urgent / emergency booking
- Confirm with the assistant that closest doctors should be contacted immediately.
- **Postcondition:** up to 3 urgent pending appointments for nearby doctors (shared emergency group); Free AI limits do not block inclusion.
- **Resolution:** first doctor to accept wins; other pending requests in the group are cancelled.

### Consult or cancel an existing AI booking
- Ask about upcoming (or recent) AI appointments (doctor, place, time, status).
- Cancel while status is **pending** (urgent: cancelling one cancels the whole group).
- **Constraint:** cannot cancel a **confirmed** booking via the assistant; must contact the doctor's office.

### Receive doctor messages on WhatsApp
- Receive appointment confirmation, medical documents, and invoices from the doctor's own WhatsApp number (after the doctor initiates the send).

### Rate a doctor after a visit
- Open a magic link received by WhatsApp after a confirmed appointment and submit a rating without creating an account.

### Be notified if a request expires
- If no doctor accepts within ~10 minutes, the pending request (or unanswered urgent group) is cancelled.
- Receive a callback and/or WhatsApp asking to call Riaya again to book with another doctor.
