output "instance_id" {
  description = "OCID of the Focus Flow compute instance."
  value       = oci_core_instance.focus_flow.id
}

output "public_ip" {
  description = "Reserved public IPv4 address of the Focus Flow VM."
  value       = oci_core_public_ip.focus_flow.ip_address
}

output "private_ip" {
  description = "Private IPv4 address of the Focus Flow VM."
  value       = data.oci_core_private_ips.focus_flow.private_ips[0].ip_address
}

output "availability_domain" {
  description = "Availability domain used by the VM."
  value       = local.selected_availability_domain
}

output "ssh_command" {
  description = "SSH command template for connecting to the VM."
  value       = "ssh ubuntu@${oci_core_public_ip.focus_flow.ip_address}"
}
