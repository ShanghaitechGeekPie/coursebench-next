#!/usr/bin/env node
/**
 * CourseBench CLI Tool
 * Usage: node cli/index.mjs <command> [args...]
 *
 * Commands:
 *   set_admin <user_id>                    Set user as admin
 *   unset_admin <user_id>                  Remove admin
 *   set_community_admin <user_id>          Set user as community admin
 *   unset_community_admin <user_id>        Remove community admin
 *   import_elrc <semester> [--dry-run] [--update-existing] Import courses from ELRC API
 *   import_teacher <csv_path>              Update teacher info from CSV
 *   import_course <csv_dir>                Import courses from CSV directory
 *   import_teacher_uniid <json_path>       Update teacher UniIDs from JSON
 *   rm_duplicate_group                     Merge duplicate course groups
 *   remove_student_teacher [--dry-run]     Merge student-ID teachers into course assistant
 *   clear_userdata Yes_Confirm             Delete ALL user data (dangerous!)
 *   stats                                  Show database statistics
 *   test_mail <to> [options]                Send a test email
 *   migrate_pg [--dry-run] [--truncate]    Copy Postgres data DATABASE_URL → DATABASE_URL_DEST
 *   migrate_blob                           (warning-only no-op)
 */

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log(`CourseBench CLI Tool

Commands:
  set_admin <user_id>                 Set user as admin
  unset_admin <user_id>               Remove admin
  set_community_admin <user_id>       Set user as community admin
  unset_community_admin <user_id>     Remove community admin
  import_elrc <semester> [--dry-run] [--update-existing] Import from ELRC API (e.g. 2024-2025-3)
  import_teacher <csv_path>           Update teacher info from CSV
  import_course <csv_dir>             Import courses from CSV directory
  import_teacher_uniid <json_path>    Update teacher UniIDs from JSON
  update_teacher_institute [--dry-run] Update teacher institutes from ELRC
  rm_duplicate_group                  Merge duplicate course groups
  remove_student_teacher [--dry-run]  Merge student-ID teachers into course assistant
  clear_userdata Yes_Confirm          Delete ALL user data (dangerous!)
  stats                               Show database statistics
  test_mail <to> [options]            Send a test email
    --subject <text>                    Custom subject
    --template register|reset           Use built-in template
    --raw <html>                        Custom HTML body
  migrate_pg [--dry-run] [--truncate] Copy Postgres data DATABASE_URL → DATABASE_URL_DEST
  migrate_blob                        (warning-only no-op)
`);
  process.exit(0);
}

try {
  switch (command) {
    case "set_admin":
    case "unset_admin":
    case "set_community_admin":
    case "unset_community_admin": {
      if (!args[1]) { console.error(`Missing <user_id>`); process.exit(1); }
      const { setAdmin, setCommunityAdmin } = await import("./commands/admin.mjs");
      if (command.includes("community")) {
        await setCommunityAdmin(Number(args[1]), !command.startsWith("unset"));
      } else {
        await setAdmin(Number(args[1]), !command.startsWith("unset"));
      }
      break;
    }
    case "import_elrc": {
      if (!args[1]) { console.error("Missing <semester>. e.g. 2024-2025-3"); process.exit(1); }
      const dryRun = args.includes("--dry-run");
      const updateExisting = args.includes("--update-existing") || args.includes("--full");
      const semester = args.find((a) => a !== "import_elrc" && !a.startsWith("--"));
      const { importELRC } = await import("./commands/import-elrc.mjs");
      await importELRC(semester, { dryRun, updateExisting });
      break;
    }
    case "import_teacher": {
      if (!args[1]) { console.error("Missing <csv_path>"); process.exit(1); }
      const { importTeacher } = await import("./commands/import-teacher.mjs");
      await importTeacher(args[1]);
      break;
    }
    case "import_course": {
      if (!args[1]) { console.error("Missing <csv_dir>"); process.exit(1); }
      const { importCourse } = await import("./commands/import-course.mjs");
      await importCourse(args[1]);
      break;
    }
    case "import_teacher_uniid": {
      if (!args[1]) { console.error("Missing <json_path>"); process.exit(1); }
      const { importTeacherUniID } = await import("./commands/import-teacher-uniid.mjs");
      await importTeacherUniID(args[1]);
      break;
    }
    case "update_teacher_institute": {
      const dryRun = args.includes("--dry-run");
      const { updateTeacherInstitute } = await import("./commands/update-teacher-institute.mjs");
      await updateTeacherInstitute({ dryRun });
      break;
    }
    case "rm_duplicate_group": {
      const { rmDuplicateGroup } = await import("./commands/rm-duplicate-group.mjs");
      await rmDuplicateGroup();
      break;
    }
    case "remove_student_teacher": {
      const dryRun = args.includes("--dry-run");
      const { removeStudentTeacher } = await import("./commands/remove-student-teacher.mjs");
      await removeStudentTeacher({ dryRun });
      break;
    }
    case "clear_userdata": {
      if (args[1] !== "Yes_Confirm") {
        console.error("Safety check failed. Usage: clear_userdata Yes_Confirm");
        process.exit(1);
      }
      const { clearUserdata } = await import("./commands/clear-userdata.mjs");
      await clearUserdata();
      break;
    }
    case "stats": {
      const { showStats } = await import("./commands/stats.mjs");
      await showStats();
      break;
    }
    case "test_mail": {
      if (!args[1]) { console.error("Missing <to>. e.g. test_mail user@example.com"); process.exit(1); }
      const to = args[1];
      const opts = {};
      for (let i = 2; i < args.length; i++) {
        if (args[i] === "--subject" && args[i + 1]) opts.subject = args[++i];
        else if (args[i] === "--template" && args[i + 1]) opts.template = args[++i];
        else if (args[i] === "--raw" && args[i + 1]) opts.raw = args[++i];
      }
      const { testMail } = await import("./commands/test-mail.mjs");
      await testMail(to, opts);
      break;
    }
    case "migrate_pg": {
      const dryRun = args.includes("--dry-run");
      const truncate = args.includes("--truncate");
      const { migratePg } = await import("./commands/migrate-pg.mjs");
      await migratePg({ dryRun, truncate });
      break;
    }
    case "migrate_blob": {
      const { migrateBlob } = await import("./commands/migrate-blob.mjs");
      await migrateBlob();
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
} catch (err) {
  console.error("ERROR:", err.message || err);
  process.exit(1);
}

process.exit(0);
