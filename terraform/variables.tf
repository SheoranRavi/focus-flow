variable "tenancy_ocid" {
  description = "OCID of the OCI tenancy (root compartment)."
  type        = string
}

variable "compartment_ocid" {
  description = "OCID of the compartment where Focus Flow resources will be created."
  type        = string
}

variable "region" {
  description = "OCI region, for example ap-hyderabad-1."
  type        = string
}

variable "oci_profile" {
  description = "Profile name in ~/.oci/config used by the OCI Terraform provider."
  type        = string
  default     = "DEFAULT"
}

variable "availability_domain" {
  description = "Availability domain to use. Leave empty to use the first AD returned for the tenancy."
  type        = string
  default     = ""
}

variable "ubuntu_image_ocid" {
  description = "Region-specific OCID for the Ubuntu 24.04 x86_64 image."
  type        = string
}

variable "public_ssh_key" {
  description = "SSH public key that will be installed for the ubuntu user."
  type        = string
  sensitive   = true
}

variable "admin_cidr" {
  description = "CIDR allowed to SSH to the VM. Use your public IP as /32, e.g. 203.0.113.10/32."
  type        = string
}

variable "vcn_cidr" {
  description = "CIDR block for the VCN."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet."
  type        = string
  default     = "10.0.10.0/24"
}

variable "instance_name" {
  description = "Display name for the Focus Flow VM."
  type        = string
  default     = "focus-flow-vm"
}
