# Unit & Regression Tests

Automated verification scripts for field alias normalization, substring collision guards, and regex matching logic.

### Test Suites
- `test_lipid_bilirubin.js`: Validates LDL vs VLDL discrimination and multi-level Bilirubin extraction.
- `test_thyroid.js`: Validates T3 vs T4 and Thyroid Function Test parameters.
- `test_esr_rdw.js`: Regression tests for ESR, RDW, and common hematology aliases.

### Running Tests
Execute via Node.js:
```bash
node tests/test_lipid_bilirubin.js
node tests/test_thyroid.js
node tests/test_esr_rdw.js
```
