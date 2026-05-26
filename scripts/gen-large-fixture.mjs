import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const N = parseInt(process.argv[2] || '5000', 10);

const lines = [
  'ERMHDR\t24.12\t2024-01-15\tlens\tdbx\tUSD',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tplan_start_date\tplan_end_date\tlast_recalc_date',
  '%R\t1\tSYNTH\t2024-01-01 08:00\t2026-12-31 17:00\t2024-06-01 09:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tproj_id\tbase_clndr_id\tday_hr_cnt\tweek_hr_cnt\tmonth_hr_cnt\tyear_hr_cnt\tdefault_flag\tclndr_data',
  '%R\t1\tStd\tCA_Base\t\t\t8\t40\t172\t2000\tY\t',
  '%T\tPROJWBS',
  '%F\twbs_id\tparent_wbs_id\tproj_id\twbs_short_name\twbs_name\tseq_num\tproj_node_flag\tsum_data_flag',
  '%R\t10\t\t1\tROOT\tRoot\t1\tY\tN',
  '%T\tTASK',
  '%F\ttask_id\ttask_code\ttask_name\tproj_id\twbs_id\tclndr_id\tstatus_code\ttask_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tact_start_date\tact_end_date\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt\tphys_complete_pct\tcomplete_pct_type'
];
for (let i = 1; i <= N; i++) {
  lines.push(`%R\t${1000 + i}\tA${String(i).padStart(5, '0')}\tActivity ${i}\t1\t10\t1\tTK_NotStart\tTT_Task\t8\t8\t\t\t2024-01-15 08:00\t2024-01-15 17:00\t\t\t\t\t0\t0\t0\tCP_Drtn`);
}
lines.push('%T\tTASKPRED');
lines.push('%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt\tcomments');
for (let i = 2; i <= N; i++) {
  lines.push(`%R\t${5000 + i}\t${1000 + i}\t${999 + i}\t1\t1\tPR_FS\t0\t`);
}
lines.push('%E');
writeFileSync(join(__dirname, '..', 'tests', 'fixtures', 'large-synthetic.xer'), lines.join('\n'));
console.log(`Wrote ${N} activities to large-synthetic.xer`);
