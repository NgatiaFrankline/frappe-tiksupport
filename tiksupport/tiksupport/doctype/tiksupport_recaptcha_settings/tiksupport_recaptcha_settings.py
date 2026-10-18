import frappe
from frappe import _
from frappe.model.document import Document


class TikSupportreCAPTCHASettings(Document):
    def validate(self):
        if not self.enabled:
            return

        if not self.site_key or not self.get_password("secret_key", raise_exception=False):
            frappe.throw(
                _("Enter both the reCAPTCHA site key and secret key before enabling reCAPTCHA.")
            )
