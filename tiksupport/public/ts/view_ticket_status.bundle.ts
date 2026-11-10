import {
  callApi,
  callMultipartApi,
  getRecaptchaToken,
  lazyLoadTicketSceneImages,
  resetRecaptcha,
  showMessage,
} from "./ticket_api";

lazyLoadTicketSceneImages();

const page = document.getElementById("view-ticket-status-page");
const statusForm = document.getElementById("view-ticket-status-form") as HTMLFormElement | null;
const statusResult = document.getElementById("view-ticket-status-result");
const statusButton = statusForm?.querySelector<HTMLButtonElement>('button[type="submit"]');
const formHost = statusForm?.parentElement;

interface TicketAttachment {
  file_name: string;
  file_url: string;
}

interface TicketCommunication {
  name: string;
  content: string;
  creation: string;
  sent_or_received: string;
  sender: string;
  attachments: TicketAttachment[];
}

interface TicketStatus {
  name: string;
  subject: string;
  status: string;
  conversation: TicketCommunication[];
}

if (page && statusForm && statusResult) {
  statusForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusResult.replaceChildren();
    statusForm.classList.add("was-validated");
    if (!statusForm.checkValidity()) {
      statusForm.querySelector<HTMLElement>(":invalid")?.focus();
      return;
    }

    const recaptchaEnabled = page.dataset.recaptchaEnabled === "true";
    const form = new FormData(statusForm);
    const ticketNumber = String(form.get("ticket_number") || "");
    const email = String(form.get("email") || "");
    statusResult.hidden = false;
    setLoading(statusButton, "Checking status…");

    try {
      const recaptchaResponse = getRecaptchaToken(recaptchaEnabled);
      const result = await callApi<TicketStatus>(
        page.dataset.csrfToken || "",
        "tiksupport.api.check_ticket_status",
        {
          ticket_number: ticketNumber,
          email,
          recaptcha_response: recaptchaResponse,
        },
      );
      statusResult.replaceChildren(createStatusCard(page, result));
      formHost?.insertBefore(statusResult, statusForm);
      statusForm.remove();
      resetRecaptcha(recaptchaEnabled);
    } catch (error) {
      resetRecaptcha(recaptchaEnabled);
      setLoading(statusButton, "Check status");
      showMessage(statusResult, (error as Error).message, true);
    }
  });
}

function setLoading(button: HTMLButtonElement | null | undefined, label: string): void {
  if (!button) return;
  button.disabled = label !== "Check status";
  button.replaceChildren();
  if (button.disabled) {
    const spinner = document.createElement("span");
    spinner.className = "ticket-button-spinner";
    spinner.setAttribute("aria-hidden", "true");
    button.append(spinner);
  }
  button.append(document.createTextNode(label));
}

function createStatusCard(
  page: HTMLElement,
  result: TicketStatus,
): HTMLElement {
  const card = document.createElement("section");
  card.className = "ticket-result-card ticket-result-card--status";
  card.setAttribute("aria-labelledby", "ticket-status-success-title");

  const title = document.createElement("h3");
  title.id = "ticket-status-success-title";
  title.className = "ticket-result-card__title";
  title.textContent = result.subject;
  card.append(title);

  const ticketNumber = document.createElement("p");
  ticketNumber.className = "ticket-result-card__ticket-number";
  ticketNumber.textContent = result.name;
  card.append(ticketNumber);

  const statusLabel = document.createElement("span");
  statusLabel.className = "ticket-status-badge";
  statusLabel.textContent = `${page.dataset.statusLabel || "Status"}: ${result.status}`;
  statusLabel.setAttribute("role", "status");
  card.append(statusLabel);

  const conversation = document.createElement("div");
  conversation.className = "ticket-conversation";
  renderConversation(conversation, result.conversation);
  card.append(conversation);

  const note = document.createElement("p");
  note.className = "ticket-result-card__note";
  note.textContent = page.dataset.statusEmailNote || "";
  card.append(note);

  const replyForm = document.createElement("form");
  replyForm.className = "ticket-reply-form";
  replyForm.setAttribute("aria-label", "Reply to this ticket");

  const replyLabel = document.createElement("label");
  replyLabel.className = "ticket-reply-form__label";
  replyLabel.htmlFor = "ticket-public-reply";
  replyLabel.textContent = page.dataset.statusReplyLabel || "Send a reply";
  replyForm.append(replyLabel);

  const replyInput = document.createElement("textarea");
  replyInput.className = "form-control";
  replyInput.id = "ticket-public-reply";
  replyInput.name = "message";
  replyInput.rows = 4;
  replyInput.maxLength = 10000;
  replyInput.required = true;
  replyInput.placeholder = page.dataset.statusReplyPlaceholder || "Write your message to the support team…";
  replyForm.append(replyInput);

  const replyFiles = document.createElement("input");
  replyFiles.className = "ticket-reply-form__files";
  replyFiles.type = "file";
  replyFiles.name = "attachments";
  replyFiles.multiple = true;
  replyFiles.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif";
  replyForm.append(replyFiles);

  const replyHint = document.createElement("small");
  replyHint.className = "ticket-reply-form__hint";
  replyHint.textContent = page.dataset.statusAttachmentHint || "You can attach up to 5 files, 10 MB each.";
  replyForm.append(replyHint);

  const replyFeedback = document.createElement("p");
  replyFeedback.className = "ticket-reply-form__feedback ticket-alert alert";
  replyFeedback.setAttribute("role", "status");
  replyFeedback.setAttribute("aria-live", "polite");
  replyFeedback.hidden = true;
  replyForm.append(replyFeedback);

  const replyButton = document.createElement("button");
  replyButton.className = "btn btn-primary";
  replyButton.type = "submit";
  setReplyButtonContent(replyButton, page.dataset.statusSendLabel || "Send reply");
  replyForm.append(replyButton);

  replyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!replyForm.checkValidity()) {
      replyInput.focus();
      return;
    }
    const files = Array.from(replyFiles.files || []);
    setReplyLoading(replyButton, true);
    replyFeedback.textContent = "";
    try {
      const recaptchaResponse = getRecaptchaToken(page.dataset.recaptchaEnabled === "true");
      const response = await callMultipartApi<{ conversation: TicketCommunication[] }>(
        page.dataset.csrfToken || "",
        "tiksupport.api.reply_to_ticket",
        {
          ticket_number: result.name,
          email: emailFromStatusForm(),
          message: replyInput.value.trim(),
          recaptcha_response: recaptchaResponse,
          attachments: files,
        },
      );
      renderConversation(conversation, response.conversation);
      replyInput.value = "";
      replyFiles.value = "";
      replyFeedback.hidden = false;
      replyFeedback.className = "ticket-reply-form__feedback ticket-alert alert alert-success";
      replyFeedback.setAttribute("role", "status");
      replyFeedback.textContent = page.dataset.statusSentLabel || "Your reply has been sent.";
    } catch (error) {
      replyFeedback.hidden = false;
      replyFeedback.className = "ticket-reply-form__feedback ticket-alert alert alert-danger";
      replyFeedback.setAttribute("role", "alert");
      replyFeedback.textContent = (error as Error).message;
    } finally {
      resetRecaptcha(page.dataset.recaptchaEnabled === "true");
      setReplyLoading(replyButton, false);
    }
  });
  if (result.status.toLowerCase() !== "closed") {
    const recaptcha = document.querySelector<HTMLElement>(
      "#view-ticket-status-page .ticket-recaptcha",
    );
    if (recaptcha) card.append(recaptcha);
    card.append(replyForm);
  }

  const again = document.createElement("button");
  again.className = "btn btn-outline-primary";
  again.type = "button";
  setAgainButtonContent(again, page.dataset.statusAgainLabel || "Check another ticket");
  again.addEventListener("click", () => {
    if (!formHost || !statusForm) return;
    statusForm.reset();
    statusForm.classList.remove("was-validated");
    setLoading(statusButton, "Check status");
    statusResult.replaceChildren();
    statusResult.hidden = true;
    formHost.insertBefore(statusForm, statusResult);
    statusForm.insertBefore(statusResult, statusButton || null);
    statusForm.querySelector<HTMLInputElement>("input")?.focus();
  });
  card.append(again);
  return card;
}

function emailFromStatusForm(): string {
  return String(new FormData(statusForm as HTMLFormElement).get("email") || "");
}

function renderConversation(container: HTMLElement, messages: TicketCommunication[]): void {
  container.replaceChildren();
  const title = document.createElement("h4");
  title.className = "ticket-conversation__title";
  title.textContent = pageLabel("statusConversationLabel", "Conversation");
  container.append(title);

  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "ticket-conversation__empty";
    empty.textContent = pageLabel("statusEmptyConversation", "No messages have been exchanged yet.");
    container.append(empty);
    return;
  }

  messages.forEach((message) => {
    const item = document.createElement("article");
    item.className = `ticket-message ticket-message--${message.sent_or_received.toLowerCase()}`;

    const header = document.createElement("header");
    const sender = document.createElement("strong");
    sender.textContent = message.sent_or_received === "Received"
      ? pageLabel("statusYouLabel", "You")
      : pageLabel("statusSupportLabel", "Support team");
    const date = document.createElement("time");
    date.dateTime = message.creation;
    date.textContent = new Date(message.creation).toLocaleString();
    header.append(sender, date);
    item.append(header);

    const content = document.createElement("p");
    content.textContent = htmlToText(message.content);
    item.append(content);

    if (message.attachments?.length) {
      const files = document.createElement("p");
      files.className = "ticket-message__attachments";
      files.textContent = `Attachments: ${message.attachments.map((file) => file.file_name).join(", ")}`;
      item.append(files);
    }
    container.append(item);
  });
}

function pageLabel(key: string, fallback: string): string {
  return page?.dataset[key] || fallback;
}

function htmlToText(content: string): string {
  const parser = new DOMParser();
  return parser.parseFromString(content, "text/html").body.textContent?.trim() || "";
}

function setReplyLoading(button: HTMLButtonElement, loading: boolean): void {
  button.disabled = loading;
  button.replaceChildren();
  if (loading) {
    const spinner = document.createElement("span");
    spinner.className = "ticket-button-spinner";
    spinner.setAttribute("aria-hidden", "true");
    button.append(spinner, document.createTextNode("Sending…"));
  } else {
    setReplyButtonContent(button, pageLabel("statusSendLabel", "Send reply"));
  }
}

function setReplyButtonContent(button: HTMLButtonElement, label: string): void {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "mr-2");
  icon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "18");
  icon.setAttribute("height", "18");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrow.setAttribute("d", "m22 2-7 20-4-9-9-4Z");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", "M22 2 11 13");
  icon.append(arrow, line);

  button.replaceChildren(icon, document.createTextNode(label));
}

function setAgainButtonContent(button: HTMLButtonElement, label: string): void {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "ml-2");
  icon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "18");
  icon.setAttribute("height", "18");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", "M5 12h14");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrow.setAttribute("d", "m13 6 6 6-6 6");
  icon.append(line, arrow);

  button.replaceChildren(document.createTextNode(label), icon);
}
