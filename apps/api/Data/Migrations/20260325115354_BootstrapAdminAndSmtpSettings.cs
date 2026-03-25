using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Photobooth.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class BootstrapAdminAndSmtpSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_bootstrap",
                table: "admin_users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "login_id",
                table: "admin_users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "must_change_password",
                table: "admin_users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "smtp_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    host = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    port = table.Column<int>(type: "integer", nullable: false),
                    username = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    password = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    from_address = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    from_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    use_ssl = table.Column<bool>(type: "boolean", nullable: false),
                    use_start_tls = table.Column<bool>(type: "boolean", nullable: false),
                    is_verified = table.Column<bool>(type: "boolean", nullable: false),
                    verified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_smtp_configurations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_users_login_id",
                table: "admin_users",
                column: "login_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_smtp_configurations_updated_at",
                table: "smtp_configurations",
                column: "updated_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "smtp_configurations");

            migrationBuilder.DropIndex(
                name: "IX_admin_users_login_id",
                table: "admin_users");

            migrationBuilder.DropColumn(
                name: "is_bootstrap",
                table: "admin_users");

            migrationBuilder.DropColumn(
                name: "login_id",
                table: "admin_users");

            migrationBuilder.DropColumn(
                name: "must_change_password",
                table: "admin_users");
        }
    }
}
