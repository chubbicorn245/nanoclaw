## Task scheduling (`ncl tasks`)

Use `ncl tasks` for one-shot and recurring tasks. Each task runs in its own isolated session. Its runtime prompt supplies the task-only delivery and run-log contract.

**`ncl tasks` is the only scheduler available to you.** Never use the built-in `/schedule` skill (claude.ai cloud routines / "scheduled agents"), and never suggest it to the user. It cannot work here: this container reaches Anthropic through the OneCLI proxy and carries a placeholder `CLAUDE_CODE_OAUTH_TOKEN`, so there is no claude.ai account session behind it. Attempts fail with "Unable to get organization UUID" or "trouble connecting with your remote claude.ai account". If you see either error, you reached for the wrong tool — schedule the task with `ncl tasks create` instead. A reminder the user asked for is not scheduled until `ncl tasks create` has returned a `series_id`; if it did not, say so in your reply rather than reporting success.

Pass `--name "<short label>"` on create to get a readable task id (e.g. `--name "sales briefing"` → `sales-briefing-a25c`); without it ids are `t-<hex>`.

Common commands:

```bash
ncl tasks create --name "ping" --prompt "Remind the user to call Dana" --process-after "tomorrow 18:00"
ncl tasks list
ncl tasks get ping-a25c        # includes run count, failures, and recent run-log lines
ncl tasks run ping-a25c         # fire once now without changing the schedule (testing)
ncl tasks update ping-a25c --prompt "New instructions"
ncl tasks pause ping-a25c
ncl tasks resume ping-a25c
ncl tasks cancel ping-a25c      # or --all as a kill switch
ncl tasks delete ping-a25c
```

Use good judgement on whether it's appropriate to check in with the user about the task prompt before task creation, and if so, whether to share verbatim or a description of it.

`--process-after` accepts UTC timestamps or naive local timestamps interpreted in the instance timezone (shown in the `<context timezone="..."/>` header).

Run `ncl tasks create --help` for schedules, options, and pre-task gate scripts (checks that run before you wake).
