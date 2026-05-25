# Fixture Manifest

All `.xer` files in this directory use literal tab characters as field separators (as per the P6 XER spec). Every file starts with `ERMHDR` and ends with `%E`.

| File | Source | Purpose |
| --- | --- | --- |
| minimal-3-task.xer | extracted from `test_xer_parser.py` `_tiny_xer()` | Smallest valid XER: 2 tasks, 1 FS relationship, CS_MSO constraint, 2-level WBS. Primary happy-path fixture for parser smoke tests. |
| progress-states.xer | extracted from `test_half_step.py` `_make_xer()` | 3 tasks with mixed status codes (TK_Complete + TK_Active + TK_NotStart) and populated actual / early-start / early-end fields. Used by the Python skill as an input to `compute_half_step_xer` (AACE 29R-03 MIP 3.4 generator). This XER is NOT itself a half-step output — half-step is a property of generation provenance, not file contents. Useful here for testing progress-field parsing. |
| negative-lag.xer | derived from `test_xer_parser.py` structure | Same 2-task structure as minimal-3-task but TASKPRED lag_hr_cnt = -16 (negative lag / lead). Tests lag sign handling. |
| with-udfs.xer | extracted from `test_xer_parser.py` `test_udf_map_keys_on_table` | UDFTYPE + UDFVALUE tables with same fk_id in different table_name scopes. Tests UDF map key collision avoidance: (TASK, 100) vs (PROJECT, 1). |
| constraint-types.xer | extracted from `test_xer_parser.py` `test_constraint_counter` | 7 tasks each with a distinct cstr_type: CS_MSO, CS_MEO, CS_MSOA, CS_MEOB, CS_MANDSTART, CS_MANDFIN. Tests CONSTRAINT_TYPES lookup and constraint_counter aggregation. |
| deep-wbs.xer | extracted from `test_xer_parser_v2.py` `_tiny_xer_str()` | 3-level WBS hierarchy (Root > Child > GrandChild) with tasks assigned at leaf level. Tests WBS depth detection (commercial profile requires min depth 3). |
