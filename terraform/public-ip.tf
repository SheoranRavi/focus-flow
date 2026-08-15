data "oci_core_vnic_attachments" "focus_flow" {
  compartment_id = var.compartment_ocid
  instance_id    = oci_core_instance.focus_flow.id
}

data "oci_core_private_ips" "focus_flow" {
  vnic_id = data.oci_core_vnic_attachments.focus_flow.vnic_attachments[0].vnic_id
}

resource "oci_core_public_ip" "focus_flow" {
  compartment_id = var.compartment_ocid
  display_name   = "focus-flow-public-ip"
  lifetime       = "RESERVED"
  private_ip_id  = data.oci_core_private_ips.focus_flow.private_ips[0].id

  freeform_tags = {
    project    = "focus-flow"
    managed_by = "terraform"
  }
}
