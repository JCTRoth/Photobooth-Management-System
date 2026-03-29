using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Photobooth.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceRuntimeTelemetry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "client_version",
                table: "devices",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_config_sync_at",
                table: "devices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_event_loaded_at",
                table: "devices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_heartbeat_error",
                table: "devices",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_upload_at",
                table: "devices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_upload_error",
                table: "devices",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_upload_file_name",
                table: "devices",
                type: "character varying(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_upload_status",
                table: "devices",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "loaded_event_name",
                table: "devices",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "local_dashboard_url",
                table: "devices",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "machine_name",
                table: "devices",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "pending_upload_count",
                table: "devices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "runtime_version",
                table: "devices",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "watch_directory",
                table: "devices",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "watcher_state",
                table: "devices",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "client_version",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "last_config_sync_at",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "last_event_loaded_at",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "last_heartbeat_error",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "last_upload_at",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "last_upload_error",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "last_upload_file_name",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "last_upload_status",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "loaded_event_name",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "local_dashboard_url",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "machine_name",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "pending_upload_count",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "runtime_version",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "watch_directory",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "watcher_state",
                table: "devices");
        }
    }
}
