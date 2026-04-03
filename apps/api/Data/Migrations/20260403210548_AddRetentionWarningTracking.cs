using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Photobooth.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRetentionWarningTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "retention_warning_sent_at",
                table: "events",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "retention_warning_sent_at",
                table: "events");
        }
    }
}
