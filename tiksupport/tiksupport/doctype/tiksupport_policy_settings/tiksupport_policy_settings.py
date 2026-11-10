import frappe
from frappe import _
from frappe.model.document import Document

from tiksupport.settings_validation import validate_settings_url


class TikSupportPolicySettings(Document):
    def validate(self):
        for row in self.policies:
            validate_settings_url(row.url)
            if row.target not in ("_self", "_blank"):
                frappe.throw(_("Policy link target must be either same tab or new tab."))
