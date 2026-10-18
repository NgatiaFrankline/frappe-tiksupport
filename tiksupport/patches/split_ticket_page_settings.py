import frappe


LEGACY_SETTINGS = "TikSupport Settings"


def execute():
    migrate_table(
        child_doctype="TikSupport Contact",
        source_field="support_contacts",
        target_doctype="TikSupport Contact Settings",
        target_field="support_contacts",
        fields=["contact_type", "label", "value"],
    )
    migrate_table(
        child_doctype="TikSupport Quick Link",
        source_field="help_links",
        target_doctype="TikSupport Footer Settings",
        target_field="help_links",
        fields=["label", "url", "icon"],
    )
    migrate_table(
        child_doctype="TikSupport Quick Link",
        source_field="navbar_links",
        target_doctype="TikSupport Navbar Settings",
        target_field="navbar_links",
        fields=["label", "url", "icon"],
    )


def migrate_table(child_doctype, source_field, target_doctype, target_field, fields):
    if not frappe.db.exists("DocType", target_doctype):
        return

    source_rows = frappe.get_all(
        child_doctype,
        filters={
            "parent": LEGACY_SETTINGS,
            "parenttype": LEGACY_SETTINGS,
            "parentfield": source_field,
        },
        fields=fields,
        order_by="idx asc",
    )
    if not source_rows:
        return

    target = frappe.get_single(target_doctype)
    if target.get(target_field):
        return

    for row in source_rows:
        target.append(target_field, row)
    target.save(ignore_permissions=True)
