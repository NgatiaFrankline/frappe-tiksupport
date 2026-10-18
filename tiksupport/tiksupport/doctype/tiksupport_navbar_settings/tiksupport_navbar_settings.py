from frappe.model.document import Document

from tiksupport.settings_validation import validate_settings_url


class TikSupportNavbarSettings(Document):
    def validate(self):
        for row in self.navbar_links:
            validate_settings_url(row.url)
