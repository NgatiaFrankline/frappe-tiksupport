import frappe


def execute():
    doctype = "TikSupport reCAPTCHA Settings"
    if frappe.db.exists("DocType", doctype):
        frappe.db.set_value("DocType", doctype, "module", "TikSupport", update_modified=False)

    frappe.clear_cache()
