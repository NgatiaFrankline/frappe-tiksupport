from urllib.parse import urlsplit

from frappe.model.document import Document

from tiksupport.settings_validation import validate_after_ticket_steps


class TikSupportSettings(Document):
    def validate(self):
        validate_after_ticket_steps(self.after_ticket_steps)
