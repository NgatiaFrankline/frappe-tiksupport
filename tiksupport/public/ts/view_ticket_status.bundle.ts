import { callApi, getRecaptchaToken, lazyLoadTicketSceneImages, resetRecaptcha, showMessage } from "./ticket_api";

lazyLoadTicketSceneImages();

const page = document.getElementById("view-ticket-status-page");
const statusForm = document.getElementById("view-ticket-status-form") as HTMLFormElement | null;
const statusResult = document.getElementById("view-ticket-status-result");

if (page && statusForm && statusResult) {
  statusForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusResult.replaceChildren();
    const recaptchaEnabled = page.dataset.recaptchaEnabled === "true";
    const form = new FormData(statusForm);
    try {
      const recaptchaResponse = getRecaptchaToken(recaptchaEnabled);
      const result = await callApi<{ name: string; subject: string; status: string }>(
        page.dataset.csrfToken || "",
        "tiksupport.api.check_ticket_status",
        {
          ticket_number: form.get("ticket_number"),
          email: form.get("email"),
          recaptcha_response: recaptchaResponse,
        },
      );
      showMessage(
        statusResult,
        `${result.name}: ${result.subject} — ${page.dataset.statusLabel}: ${result.status}`,
      );
      resetRecaptcha(recaptchaEnabled);
    } catch (error) {
      resetRecaptcha(recaptchaEnabled);
      showMessage(statusResult, (error as Error).message, true);
    }
  });
}
