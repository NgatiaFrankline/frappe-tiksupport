import { callApi, getRecaptchaToken, lazyLoadTicketSceneImages, resetRecaptcha, showMessage } from "./ticket_api";

lazyLoadTicketSceneImages();

const page = document.getElementById("create-ticket-page");
const createForm = document.getElementById("create-ticket-create-form") as HTMLFormElement | null;
const createResult = document.getElementById("create-ticket-create-result");
const createButton = createForm?.querySelector<HTMLButtonElement>('button[type="submit"]');

if (page && createForm && createResult) {
  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    createResult.replaceChildren();
    createForm.classList.add("was-validated");
    if (!createForm.checkValidity()) {
      createForm.querySelector<HTMLElement>(":invalid")?.focus();
      return;
    }
    const recaptchaEnabled = page.dataset.recaptchaEnabled === "true";
    const form = new FormData(createForm);
    const submittedEmail = String(form.get("email") || "");
    const submittedSubject = String(form.get("ticket_type") || "");
    const submittedDescription = String(form.get("description") || "");
    createResult.hidden = false;
    setLoading(createButton, "Submitting your request…");
    try {
      const recaptchaResponse = getRecaptchaToken(recaptchaEnabled);
      const result = await callApi<{ name: string }>(
        page.dataset.csrfToken || "",
        "tiksupport.api.create_ticket",
        {
          email: form.get("email"),
          ticket_type: form.get("ticket_type"),
          description: form.get("description"),
          email_communication_consent: form.get("email_communication_consent") === "1",
          recaptcha_response: recaptchaResponse,
        },
      );
      createResult.replaceChildren();
      createResult.hidden = false;
      createForm.parentElement?.insertBefore(createResult, createForm);
      createForm.remove();
      createResult.append(createSuccessCard(
        page,
        result.name,
        submittedEmail,
        submittedSubject,
        submittedDescription,
      ));
      resetRecaptcha(recaptchaEnabled);
    } catch (error) {
      resetRecaptcha(recaptchaEnabled);
      setLoading(createButton, "Submit");
      showMessage(createResult, (error as Error).message, true);
    }
  });
}

function setLoading(button: HTMLButtonElement | null | undefined, label: string): void {
  if (!button) return;
  button.disabled = label !== "Submit";
  button.replaceChildren();
  if (button.disabled) {
    const spinner = document.createElement("span");
    spinner.className = "ticket-button-spinner";
    spinner.setAttribute("aria-hidden", "true");
    button.append(spinner);
  }
  button.append(document.createTextNode(label));
}

function createSuccessCard(
  page: HTMLElement,
  ticketNumber: string,
  email: string,
  subject: string,
  description: string,
): HTMLElement {
  const card = document.createElement("section");
  card.className = "ticket-result-card ticket-result-card--success";
  card.setAttribute("aria-labelledby", "create-ticket-success-title");

  const title = document.createElement("h3");
  title.id = "create-ticket-success-title";
  title.className = "ticket-result-card__title";
  title.textContent = page.dataset.ticketCreatedLabel || "Your ticket number is";
  card.append(title);

  const number = document.createElement("p");
  number.className = "ticket-number";
  number.textContent = ticketNumber;
  number.setAttribute("aria-label", `${page.dataset.ticketCreatedLabel || "Ticket number"} ${ticketNumber}`);
  card.append(number);

  const details = document.createElement("dl");
  details.className = "ticket-result-details";
  addDetail(details, page.dataset.ticketEmailLabel || "Confirmation email", email);
  addDetail(details, page.dataset.ticketSubjectLabel || "Subject", subject);
  addDetail(details, page.dataset.ticketDescriptionLabel || "Your request", description);
  card.append(details);

  const nextStep = document.createElement("p");
  nextStep.className = "ticket-result-card__note";
  nextStep.textContent = page.dataset.ticketNextStep || "";
  card.append(nextStep);

  const link = document.createElement("a");
  link.className = "btn btn-primary";
  link.href = "/create-ticket";
  link.textContent = page.dataset.ticketNewLabel || "Submit another request";
  card.append(link);
  return card;
}

function addDetail(list: HTMLDListElement, label: string, value: string): void {
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  list.append(term, description);
}
