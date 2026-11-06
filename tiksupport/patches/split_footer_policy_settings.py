import frappe


def execute():
    target_doctype = "TikSupport Policy Settings"
    if not frappe.db.exists("DocType", target_doctype):
        return

    target = frappe.get_single(target_doctype)
    if target.get("policies"):
        return

    rows = frappe.get_all(
        "TikSupport Policy Link",
        filters={
            "parent": "TikSupport Footer Settings",
            "parenttype": "TikSupport Footer Settings",
            "parentfield": "policies",
        },
        pluck="name",
    )
    for row_name in rows:
        frappe.db.set_value(
            "TikSupport Policy Link",
            row_name,
            {
                "parent": target_doctype,
                "parenttype": target_doctype,
                "parentfield": "policies",
            },
            update_modified=False,
        )
