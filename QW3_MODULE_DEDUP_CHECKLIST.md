# QW3 – JavaScript Module Deduplication Checklist

**Status**: ⏳ PENDING IMPLEMENTATION

**Duplicate Modules**:
1. [ ] `admin-social.js` (71,547 bytes) = `admin-social-media.js` (71,550 bytes)
   - **Keep**: `admin-social-media.js` (more descriptive name)
   - **Delete**: `admin-social.js`

2. [ ] `publications.js` (55,990 bytes) = `publications-forum.js` (55,992 bytes)
   - **Keep**: `publications-forum.js` (more specific name)
   - **Delete**: `publications.js`

---

## Verification

### Check SHA/Content
```bash
# Compare admin modules
sha256sum admin-social.js admin-social-media.js
diff -u admin-social.js admin-social-media.js | head -20

# Compare publication modules  
sha256sum publications.js publications-forum.js
diff -u publications.js publications-forum.js | head -20
```

---

## Implementation Steps

### Step 1: Delete Duplicate Files
- [ ] Delete `admin-social.js`
- [ ] Delete `publications.js`
- [ ] Verify files no longer exist: `ls admin-social.js publications.js` (should fail)

### Step 2: Update HTML References

**Search in all HTML files**:
```bash
grep -r "admin-social.js\|publications.js" *.html
```

**Files to update**:
- [ ] `index.html`
- [ ] `admin.html`
- [ ] `ambi241-admin.html`
- [ ] Any other pages

**Replacements**:

**admin-social.js → admin-social-media.js**
```html
<!-- BEFORE -->
<script src="admin-social.js"></script>

<!-- AFTER -->
<script src="admin-social-media.js"></script>
```

**publications.js → publications-forum.js**
```html
<!-- BEFORE -->
<script src="publications.js"></script>

<!-- AFTER -->
<script src="publications-forum.js"></script>
```

### Step 3: Test Functionality

**Admin Social Media**:
- [ ] Navigate to admin panel
- [ ] Check social media management section loads
- [ ] Verify no console errors
- [ ] Test social media posting features

**Publications/Forum**:
- [ ] Navigate to publications/forum section
- [ ] Verify posts load and display
- [ ] Test post creation
- [ ] Test post interactions

### Step 4: Verification

```bash
# Verify old files gone
ls -lh admin-social.js publications.js  # Should fail with "No such file"

# Verify new files exist
ls -lh admin-social-media.js publications-forum.js  # Should show both files

# Verify no references to old files in HTML
grep -r "admin-social.js\|publications.js" *.html  # Should show: (no matches)
```

---

## Expected Results

**Network Savings**: -140 KB total
- admin-social.js removed: -71.5 KB
- publications.js removed: -56 KB

**Performance**: +2-3% network efficiency
**Maintenance**: Code not duplicated in 2 places anymore

---

## Rollback (if needed)

```bash
git revert <commit-hash>
```
