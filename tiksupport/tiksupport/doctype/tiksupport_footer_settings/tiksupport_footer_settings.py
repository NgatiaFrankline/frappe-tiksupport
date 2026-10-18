from frappe.model.document import Document

from tiksupport.settings_validation import validate_settings_url


class TikSupportFooterSettings(Document):
    def validate(self):
        for row in self.help_links:
            validate_settings_url(row.url)
