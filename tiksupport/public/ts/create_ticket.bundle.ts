import { callApi, getRecaptchaToken, lazyLoadTicketSceneImages, resetRecaptcha, showMessage } from "./ticket_api";

lazyLoadTicketSceneImages();

const page = document.getElementById("create-ticket-page");
const createForm = document.getElementById("create-ticket-create-form") as HTMLFormElement | null;
const createResult = document.getElementById("create-ticket-create-result");

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
      showMessage(createResult, `${page.dataset.ticketCreatedLabel}: ${result.name}`);
      createForm.reset();
      createForm.classList.remove("was-validated");
      resetRecaptcha(recaptchaEnabled);
    } catch (error) {
      resetRecaptcha(recaptchaEnabled);
      showMessage(createResult, (error as Error).message, true);
    }
  });
}
