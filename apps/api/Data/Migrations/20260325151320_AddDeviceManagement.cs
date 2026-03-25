using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Photobooth.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "devices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    public_key = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: false),
                    last_seen_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    assigned_event_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_devices", x => x.id);
                    table.ForeignKey(
                        name: "FK_devices_events_assigned_event_id",
                        column: x => x.assigned_event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "device_request_nonces",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    nonce = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    signed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_request_nonces", x => x.id);
                    table.ForeignKey(
                        name: "FK_device_request_nonces_devices_device_id",
                        column: x => x.device_id,
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_device_request_nonces_created_at",
                table: "device_request_nonces",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_device_request_nonces_device_id_nonce",
                table: "device_request_nonces",
                columns: new[] { "device_id", "nonce" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_device_request_nonces_expires_at",
                table: "device_request_nonces",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "IX_devices_assigned_event_id",
                table: "devices",
                column: "assigned_event_id");

            migrationBuilder.CreateIndex(
                name: "IX_devices_last_seen_at",
                table: "devices",
                column: "last_seen_at");

            migrationBuilder.CreateIndex(
                name: "IX_devices_name",
                table: "devices",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_devices_status",
                table: "devices",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "device_request_nonces");

            migrationBuilder.DropTable(
                name: "devices");
        }
    }
}
