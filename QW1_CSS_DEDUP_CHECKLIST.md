# QW1 – CSS Deduplication Checklist

**Status**: ⏳ PENDING IMPLEMENTATION

**Files Affected**: 
- [ ] `styles.css` (509 KB) – DELETE
- [ ] `style.css` (509 KB) – KEEP

**Verification**: SHA Identical
```
style.css:  764f1fb1d1260e1473034da798ab099a62c6eec6
styles.css: 764f1fb1d1260e1473034da798ab099a62c6eec6
```

---

## Implementation Steps

### Step 1: Delete Duplicate File
- [ ] Verify `styles.css` and `style.css` are identical
- [ ] Delete `styles.css`
- [ ] Commit: "Remove duplicate styles.css"

### Step 2: Update HTML References

**Files to check**:
- [ ] `index.html`
- [ ] `admin.html`
- [ ] `ambi241-admin.html`
- [ ] Any other HTML files

**Search for**:
```
href="styles.css"
```

**Replace with**:
```
href="style.css"
```

### Step 3: Testing

- [ ] Open DevTools → Network tab
- [ ] Verify `style.css` loads (not `styles.css`)
- [ ] Check no CSS is missing (visual inspection)
- [ ] Verify responsive design on mobile view
- [ ] Check all theme colors display correctly

### Step 4: Verification

```bash
# Verify file no longer exists
ls -lh styles.css  # Should show: "No such file"

# Verify references updated
grep -r "styles.css" *.html  # Should show: (no matches)

# File size reduction
du -sh style.css   # ~509 KB
```

---

## Expected Results

**Network Savings**: -509 KB per user
**Performance**: +3-5% FCP improvement
**Cache**: Improved (no duplicate entry)

---

## Rollback (if needed)

```bash
git revert <commit-hash>
```
