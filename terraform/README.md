# Focus Flow OCI infrastructure

Terraform creates:

- OCI VCN
- Public subnet
- Internet gateway
- Route table
- Custom security list
- Ampere A1 Flex VM (2 OCPU / 12 GB)
- Ubuntu 24.04 ARM64
- Cloud-init bootstrap with Docker, Docker Compose, Git, and UFW

## Before `terraform apply`

1. Install Terraform.
2. Install/configure the OCI CLI and create `~/.oci/config`.
3. Copy `terraform.tfvars.example` to `terraform.tfvars`.
4. Fill in:
   - `tenancy_ocid`
   - `compartment_ocid`
   - `region`
   - `ubuntu_image_ocid`
   - `public_ssh_key`
   - `admin_cidr`

## Commands

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```

After apply:

```bash
terraform output public_ip
terraform output ssh_command
```

Then:

```bash
ssh ubuntu@$(terraform output -raw public_ip)
```

## Important

The Ubuntu image OCID is intentionally a variable. OCI recommends pinning a region-specific image OCID rather than resolving the latest image dynamically, so a later `terraform apply` does not silently switch the VM to a different image.

Do not commit `terraform.tfvars` or Terraform state files.
