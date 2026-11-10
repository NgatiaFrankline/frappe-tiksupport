import frappe
import requests
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import escape_html, get_assets_json, validate_email_address
from frappe.utils.file_manager import save_file


def inject_login_public_links(response, request):
    if request.path != "/login" or response.mimetype != "text/html":
        return

    body = response.get_data()
    if b'tiksupport-login-links' in body:
        return

    login_links = (
        b'<nav class="tiksupport-login-links" aria-label="Helpdesk links">'
        b'<a href="/">Home</a>'
        b'<a href="/create-ticket">Create a ticket</a>'
        b'<a href="/view-ticket-status">Check ticket status</a>'
        b"</nav>"
    )
    section_end = b"</section>"
    if section_end not in body:
        return

    body = body.replace(section_end, login_links + section_end, 1)
    response.set_data(body)


def inject_helpdesk_sidebar_assets(response, request):
    if request.path != "/helpdesk" and not request.path.startswith("/helpdesk/"):
        return
    if response.mimetype != "text/html":
        return

    body = response.get_data()
    if b"/assets/helpdesk/desk/assets/" not in body:
        return

    assets = get_assets_json()
    global_stylesheet = assets.get("tiksupport_global.bundle.css")
    sidebar_stylesheet = assets.get("helpdesk_sidebar.bundle.css")
    loader_markup = (
        b'<div class="tiksupport-helpdesk-loader" '
        b'role="status" aria-live="polite">'
        b'<span class="tiksupport-helpdesk-loader__spinner" aria-hidden="true"></span>'
        b'<span class="tiksupport-helpdesk-loader__message">Loading Helpdesk...</span></div>'
    )
    app_root = b'<div id="app"></div>'
    loader_app_root = b'<div id="app">' + loader_markup + b"</div>"
    if (
        global_stylesheet
        and b"tiksupport-helpdesk-loader" not in body
        and app_root in body
    ):
        body = body.replace(app_root, loader_app_root, 1)

    for stylesheet in (global_stylesheet, sidebar_stylesheet):
        if not stylesheet:
            continue
        link = f'<link rel="stylesheet" href="{stylesheet}">'.encode()
        if b"</head>" in body and link not in body:
            body = body.replace(b"</head>", link + b"</head>")

    script_asset = assets.get("helpdesk_sidebar.bundle.ts")
    if not frappe.db.exists("DocType", "Kustomize Settings"):
        script_asset = None
    if script_asset:
        script = f'<script src="{script_asset}"></script>'.encode()
        if b"</body>" in body and script not in body:
            body = body.replace(b"</body>", script + b"</body>")

    response.set_data(body)


def verify_recaptcha(response_token: str) -> None:
    settings = frappe.get_single("TikSupport reCAPTCHA Settings")
    if not settings.enabled:
        return

    secret_key = settings.get_password("secret_key", raise_exception=False)
    response_token = (response_token or "").strip()
    if not settings.site_key or not secret_key:
        frappe.throw(
            _("Google reCAPTCHA is enabled but is not fully configured. Please contact support.")
        )
    if not response_token or len(response_token) > 4096:
        frappe.throw(_("Please complete the reCAPTCHA checkbox."))

    try:
        response = requests.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": secret_key, "response": response_token},
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException:
        frappe.log_error(
            title=_("Google reCAPTCHA request failed"),
            message=frappe.get_traceback(),
        )
        frappe.throw(
            _("Google reCAPTCHA verification is temporarily unavailable. Please try again.")
        )
    try:
        verification = response.json()
    except ValueError:
        frappe.log_error(
            title=_("Google reCAPTCHA response was invalid"),
            message=frappe.get_traceback(),
        )
        frappe.throw(
            _("Google reCAPTCHA returned an invalid response. Please try again.")
        )

    if not isinstance(verification, dict) or verification.get("success") is not True:
        frappe.throw(_("reCAPTCHA verification failed. Please try again."))


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=100, seconds=60 * 60)
def create_ticket(
    email: str,
    ticket_type: str,
    description: str,
    recaptcha_response: str = "",
    email_communication_consent: bool | str | int = False,
) -> dict[str, str]:
    email = (email or "").strip()
    ticket_type = (ticket_type or "").strip()
    description = (description or "").strip()

    has_email_communication_consent = email_communication_consent is True or (
        isinstance(email_communication_consent, (int, str))
        and str(email_communication_consent).strip().casefold() in {"1", "true", "on"}
    )
    if not has_email_communication_consent:
        frappe.throw(
            _("Please consent to using your email for communication about this support request only.")
        )

    if len(email) > 254:
        frappe.throw(_("Email address is too long."))
    validated_email = validate_email_address(email, throw=True)
    if not validated_email:
        frappe.throw(_("A valid email address is required."))
    if "," in validated_email:
        frappe.throw(_("Enter one email address."))
    if not ticket_type:
        frappe.throw(_("Ticket type is required."))
    if not frappe.db.exists("HD Ticket Type", {"name": ticket_type, "disabled": 0}):
        frappe.throw(_("Select a valid ticket type."))
    if not description:
        frappe.throw(_("Description is required."))
    if len(description) > 10000:
        frappe.throw(_("Description must be 10,000 characters or fewer."))

    verify_recaptcha(recaptcha_response)

    ticket = frappe.get_doc(
        {
            "doctype": "HD Ticket",
            "subject": ticket_type,
            "ticket_type": ticket_type,
            "description": escape_html(description).replace("\n", "<br>"),
            "raised_by": validated_email.casefold(),
            "owner": "Administrator",
            "via_customer_portal": 0,
            "email_communication_consent": 1,
            "email_communication_consent_at": frappe.utils.now_datetime(),
        }
    )
    is_guest_submission = frappe.session.user == "Guest"
    previous_public_submission = frappe.flags.get("tiksupport_public_submission")
    frappe.flags.tiksupport_public_submission = is_guest_submission
    previous_user = frappe.session.user
    try:
        # HD Ticket.after_insert tags the ticket, which checks write permission
        # on the session user and ignores ignore_permissions.
        if is_guest_submission:
            frappe.set_user("Administrator")
        ticket.insert(ignore_permissions=True)
    finally:
        if frappe.session.user != previous_user:
            frappe.set_user(previous_user)
        if previous_public_submission is None:
            frappe.flags.pop("tiksupport_public_submission", None)
        else:
            frappe.flags.tiksupport_public_submission = previous_public_submission

    if is_guest_submission:
        for name in _get_ticket_communications(ticket.name):
            frappe.db.set_value("Communication", name, "sender", validated_email.casefold())

    return {"name": ticket.name}


def _get_public_ticket(ticket_number: str, email: str) -> dict:
    ticket = frappe.db.get_value(
        "HD Ticket",
        ticket_number,
        ["name", "subject", "status", "raised_by"],
        as_dict=True,
    )
    if not ticket or (ticket.raised_by or "").strip().casefold() != email:
        frappe.throw(
            _("Ticket not found or the email address does not match."),
            frappe.DoesNotExistError,
        )
    return ticket


def _get_ticket_communications(ticket_number: str) -> list[str]:
    return frappe.get_all(
        "Communication",
        filters={"reference_doctype": "HD Ticket", "reference_name": ticket_number},
        pluck="name",
        ignore_permissions=True,
    )


def _get_public_conversation(ticket_number: str) -> list[dict]:
    communications = frappe.get_all(
        "Communication",
        filters={
            "reference_doctype": "HD Ticket",
            "reference_name": ticket_number,
        },
        fields=["name", "content", "creation", "sent_or_received", "sender"],
        order_by="creation asc",
        ignore_permissions=True,
    )
    for communication in communications:
        communication["attachments"] = frappe.get_all(
            "File",
            filters={
                "attached_to_doctype": "Communication",
                "attached_to_name": communication.name,
            },
            fields=["file_name"],
            order_by="creation asc",
            ignore_permissions=True,
        )
    return communications


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=120, seconds=5 * 60)
def check_ticket_status(
    ticket_number: str,
    email: str,
    recaptcha_response: str = "",
) -> dict[str, str]:
    ticket_number = (ticket_number or "").strip()
    email = (email or "").strip().casefold()
    if not ticket_number or not email:
        frappe.throw(_("Ticket number and email address are required."))

    verify_recaptcha(recaptcha_response)

    ticket = _get_public_ticket(ticket_number, email)

    status = frappe.db.get_value("HD Ticket Status", ticket.status, "label_customer")
    return {
        "name": ticket.name,
        "subject": ticket.subject,
        "status": status or ticket.status,
        "conversation": _get_public_conversation(ticket.name),
    }


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=30, seconds=15 * 60)
def reply_to_ticket(
    ticket_number: str,
    email: str,
    message: str,
    recaptcha_response: str = "",
) -> dict:
    ticket_number = (ticket_number or "").strip()
    email = (email or "").strip().casefold()
    message = (message or "").strip()
    if not ticket_number or not email or not message:
        frappe.throw(_("Ticket number, email address, and a message are required."))
    if len(message) > 10000:
        frappe.throw(_("Your message must be 10,000 characters or fewer."))

    verify_recaptcha(recaptcha_response)
    ticket = _get_public_ticket(ticket_number, email)
    if ticket.status == "Closed":
        frappe.throw(_("This ticket is closed and cannot receive new replies."))

    uploaded_files = (
        frappe.request.files.getlist("attachments") if frappe.request else []
    )
    if len(uploaded_files) > 5:
        frappe.throw(_("You can attach up to five files per reply."))

    attachments = []
    for uploaded_file in uploaded_files:
        if not uploaded_file or not uploaded_file.filename:
            continue
        content = uploaded_file.stream.read()
        if len(content) > 10 * 1024 * 1024:
            frappe.throw(_("Each attachment must be 10 MB or smaller."))
        file_doc = save_file(
            uploaded_file.filename,
            content,
            "HD Ticket",
            ticket.name,
            is_private=1,
        )
        attachments.append({"name": file_doc.name})

    public_submission = frappe.flags.get("tiksupport_public_submission")
    is_guest_reply = frappe.session.user == "Guest"
    frappe.flags.tiksupport_public_submission = is_guest_reply
    previous_user = frappe.session.user
    existing_communications = set(_get_ticket_communications(ticket.name))
    try:
        ticket_doc = frappe.get_doc("HD Ticket", ticket.name)
        # Saving the communication re-saves the ticket, which checks write
        # permission on the session user and ignores ignore_permissions.
        if is_guest_reply:
            frappe.set_user("Administrator")
        ticket_doc.create_communication_via_contact(
            escape_html(message).replace("\n", "<br>"),
            attachments=attachments,
        )
    finally:
        if frappe.session.user != previous_user:
            frappe.set_user(previous_user)
        if public_submission is None:
            frappe.flags.pop("tiksupport_public_submission", None)
        else:
            frappe.flags.tiksupport_public_submission = public_submission

    if is_guest_reply:
        for name in set(_get_ticket_communications(ticket.name)) - existing_communications:
            frappe.db.set_value("Communication", name, "sender", email)

    return {"conversation": _get_public_conversation(ticket.name)}
