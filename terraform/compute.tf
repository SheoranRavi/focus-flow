data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

locals {
  selected_availability_domain = var.availability_domain != "" ? var.availability_domain : data.oci_identity_availability_domains.ads.availability_domains[0].name
}

resource "oci_core_instance" "focus_flow" {
  compartment_id      = var.compartment_ocid
  availability_domain = local.selected_availability_domain
  display_name        = var.instance_name

  shape = "VM.Standard.E2.1.Micro"

  create_vnic_details {
    subnet_id                 = oci_core_subnet.public.id
    assign_public_ip          = false
    assign_private_dns_record = true
    hostname_label            = "focusflow"
  }

  source_details {
    source_id   = var.ubuntu_image_ocid
    source_type = "image"
  }

  metadata = {
    ssh_authorized_keys = var.public_ssh_key
    user_data           = base64encode(templatefile("${path.module}/cloud-init.yaml", { admin_cidr = var.admin_cidr }))
  }

  preserve_boot_volume = false

  freeform_tags = {
    project     = "focus-flow"
    environment = "production"
    managed_by  = "terraform"
  }
}
