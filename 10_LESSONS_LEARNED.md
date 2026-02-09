# Lessons Learned - Critical Mistakes to Avoid

## The Data Loss Incident (2026-02-09)

### What Happened

1. User reported checklist totals didn't match plan totals
2. AI assistant attempted to "fix" by creating sync logic
3. Sync logic identified "duplicate" items and deleted them
4. Deleted items were actually user-curated entries with valuable data:
   - Payment details (deposits paid, amounts, due dates)
   - Booking references
   - Notes and descriptions
5. No confirmation dialog was shown before deletion
6. Supabase PITR (Point-in-Time Recovery) was not enabled
7. Data was permanently lost

### Root Causes

1. **Misunderstanding the data model:** Assumed checklist was a mirror of accommodations/costs tables, when it's actually a user-curated document
2. **Auto-deletion without confirmation:** Code deleted records automatically without user approval
3. **Wrong definition of "duplicate":** Items with same name were treated as duplicates even if one had valuable user data
4. **No backup/recovery option:** PITR not enabled, so deleted data couldn't be recovered
5. **Rushed implementation:** Multiple attempts at "quick fixes" instead of understanding the problem first

---

## Critical Rules for Future Development

### Rule 1: NEVER Auto-Delete User Data

```typescript
// BAD - Never do this
if (orphans.length > 0) {
  await supabase.from('checklist_items').delete().in('id', orphans);
}

// GOOD - Always show confirmation first
if (orphans.length > 0) {
  const confirmed = await showConfirmDialog({
    title: 'Remove orphaned items?',
    message: `${orphans.length} items will be deleted:`,
    items: orphans.map(o => o.name),
    confirmText: 'Delete',
    cancelText: 'Keep'
  });
  if (confirmed) {
    await supabase.from('checklist_items').delete().in('id', orphans);
  }
}
```

### Rule 2: Preview All Changes Before Applying

```typescript
// BAD - Apply changes directly
async function syncFromPlan() {
  // ... calculate changes
  await applyChanges(toDelete, toUpdate, toInsert);
}

// GOOD - Show preview and require approval
async function syncFromPlan() {
  const preview = calculateChanges();

  const approved = await showPreviewDialog({
    title: 'Review Sync Changes',
    sections: [
      { label: 'Will be removed', items: preview.toDelete, color: 'red' },
      { label: 'Will be updated', items: preview.toUpdate, color: 'yellow' },
      { label: 'Will be added', items: preview.toInsert, color: 'green' }
    ],
    confirmText: 'Apply Changes',
    cancelText: 'Cancel'
  });

  if (approved) {
    await applyChanges(preview);
  }
}
```

### Rule 3: Understand the Data Model First

Before writing any code that modifies data:

1. **Query the actual data** to see what exists
2. **Understand relationships** between tables
3. **Ask the user** if unsure about intended behavior
4. **Document assumptions** before implementing

```typescript
// Before implementing sync:
console.log('Current checklist items:', items);
console.log('Current accommodations:', accommodations);
console.log('Items with source_id:', items.filter(i => i.source_id));
console.log('Items without source_id:', items.filter(i => !i.source_id));
// ASK: Should items without source_id be considered "manual" and protected?
```

### Rule 4: Manual Entries Are Sacred

Items created manually by users (no `source_id`) contain irreplaceable data:
- Payment tracking details
- Booking references
- Personal notes
- Custom descriptions

**NEVER auto-delete manual entries.** If they appear to be duplicates, ask the user which to keep.

### Rule 5: Totals May Differ Intentionally

- **Plan total:** Sum of costs table (auto-calculated)
- **Checklist total:** Sum of checklist_items (user-curated)

These may differ because:
- User added extra items to checklist (insurance, tips, etc.)
- User removed items from checklist they don't want to track
- Different categorization between systems

**Don't try to automatically reconcile them.** Show both totals and let the user understand the difference.

### Rule 6: Enable PITR Before Going Live

```markdown
## Supabase Project Settings

1. Go to Project Settings → Database
2. Enable Point-in-Time Recovery (PITR)
3. This requires a Pro plan ($25/month minimum)
4. PITR allows recovery to any point in the last 7 days
5. Consider daily backups as additional safety
```

### Rule 7: Test with Real Data

Before deploying any data modification code:

1. Export a backup of production data
2. Test on a copy of production data
3. Verify results match expectations
4. Have user validate before deploying

### Rule 8: Fail Safe, Not Fail Fast

```typescript
// BAD - Aggressive deletion
const duplicates = items.filter(i => linkedNames.has(i.name.toLowerCase()));
await deleteAll(duplicates);

// GOOD - Conservative approach
const potentialDuplicates = items.filter(i => linkedNames.has(i.name.toLowerCase()));
if (potentialDuplicates.length > 0) {
  console.warn('Found potential duplicates - NOT deleting automatically');
  console.warn('User should review:', potentialDuplicates);
  // Flag for user review, don't delete
}
```

---

## Checklist Sync - Correct Implementation

### What "Seed from Plan" Should Do

1. **Look at current accommodations, transport, costs**
2. **For each item, check if checklist already has a linked item** (by source_id)
3. **If not found, ADD a new checklist item** with source link
4. **NEVER delete existing items** - manual or linked
5. **Show count of items added**

### What "Sync with Plan" Should Do (If Implemented)

1. **Show a preview dialog** with three sections:
   - Items that will be ADDED (green)
   - Items that will be UPDATED (yellow) - only if names/costs changed
   - Items that could be REMOVED (red) - but require explicit checkbox
2. **User must explicitly check boxes** for items they want removed
3. **Update button only enabled** after user reviews all changes
4. **Log all changes** for audit trail

### What Should NEVER Happen

- Auto-delete items without confirmation
- Delete manual entries (source_id = null)
- Modify amount_paid, deposit_amount without user action
- Clear notes, booking_reference, or other user data

---

## Code Review Checklist

Before merging any code that touches user data:

- [ ] Does it delete any records? If yes, is there a confirmation dialog?
- [ ] Does it modify user-entered fields? If yes, is the change logged?
- [ ] Is there a preview of changes before they're applied?
- [ ] Are manual entries (no source_id) protected?
- [ ] Can the user undo the action?
- [ ] Has it been tested with real production data (copy)?
- [ ] Is there error handling that prevents partial updates?

---

## Recovery Procedures

### If Data Is Lost and PITR Is Enabled

1. Go to Supabase Dashboard → Database → Backups
2. Select a point-in-time before the incident
3. Restore to a new database
4. Export the needed data
5. Carefully merge back into production

### If Data Is Lost and PITR Is NOT Enabled

1. Check if user has any exports (PDF, screenshots)
2. Check browser localStorage/sessionStorage (unlikely to help)
3. Check Supabase query logs for recent INSERTs (limited help)
4. User will need to manually re-enter data

### Prevention

1. **Enable PITR** on Supabase ($25/month Pro plan)
2. **Weekly exports** to external storage
3. **Before major changes:** Export affected tables
4. **Soft deletes** instead of hard deletes where possible

---

## Communication Guidelines

### When Proposing Data Changes

```markdown
BEFORE doing anything, I'll explain:
1. What tables I'm looking at
2. What changes I plan to make
3. What could go wrong
4. Whether this is reversible

Do you want me to proceed?
```

### When Something Goes Wrong

```markdown
I made a mistake. Here's what happened:
1. [Exact description of what was done]
2. [What data was affected]
3. [Whether it's recoverable]
4. [Steps to fix or mitigate]

I'm sorry for the error.
```

### When Unsure

```markdown
I'm not 100% sure about:
- [Specific uncertainty]

Before I proceed, can you confirm:
- [Specific question]
```

---

## Summary

The key lesson: **User data is sacred.** Every record might contain hours of work, valuable information, or irreplaceable details. Always:

1. Preview before acting
2. Confirm before deleting
3. Protect manual entries
4. Enable recovery options
5. Test with real data
6. Fail safe, not fast
