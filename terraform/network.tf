resource "oci_core_vcn" "focus_flow" {
  compartment_id = var.compartment_ocid
  display_name   = "focus-flow-vcn"
  cidr_blocks    = [var.vcn_cidr]
  dns_label      = "focusflow"
}

resource "oci_core_internet_gateway" "focus_flow" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.focus_flow.id
  display_name   = "focus-flow-igw"
  enabled        = true
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.focus_flow.id
  display_name   = "focus-flow-public-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.focus_flow.id
  }
}

resource "oci_core_security_list" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.focus_flow.id
  display_name   = "focus-flow-public-sl"

  # SSH: restricted to the administrator's current public IP.
  ingress_security_rules {
    protocol    = "6"
    source      = var.admin_cidr
    source_type = "CIDR_BLOCK"

    tcp_options {
      min = 22
      max = 22
    }
  }

  # HTTP: needed for HTTP traffic and ACME HTTP-01 challenges.
  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    source_type = "CIDR_BLOCK"

    tcp_options {
      min = 80
      max = 80
    }
  }

  # HTTPS: public API traffic through Caddy.
  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    source_type = "CIDR_BLOCK"

    tcp_options {
      min = 443
      max = 443
    }
  }

  # Allow all outbound traffic.
  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }
}

resource "oci_core_subnet" "public" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.focus_flow.id
  display_name               = "focus-flow-public-subnet"
  cidr_block                  = var.public_subnet_cidr
  route_table_id              = oci_core_route_table.public.id
  security_list_ids           = [oci_core_security_list.public.id]
  prohibit_public_ip_on_vnic = false
  dns_label                   = "public"
}
