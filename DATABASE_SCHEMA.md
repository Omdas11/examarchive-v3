# DATABASE_SCHEMA

## Table: `Syllabus_Table`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String | **Yes** | Document ID |
| `university` | String | **Yes** | University name |
| `course` | String | **Yes** | Course name (FYUG/CBCS) |
| `type` | String | **Yes** | Paper type (DSC/DSM/SEC/AEC/VAC/IDC) |
| `paper_code` | String | **Yes** | Paper code |
| `unit_number` | Integer | **Yes** | Unit number |
| `syllabus_content` | String | **Yes** | Unit syllabus content |
| `lectures` | Integer | No | Number of lectures |
| `tags` | String | No | Topic tags |

## Table: `Questions_Table`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String | **Yes** | Document ID |
| `university` | String | **Yes** | University name |
| `course` | String | **Yes** | Course name (FYUG/CBCS) |
| `type` | String | **Yes** | Paper type |
| `paper_code` | String | **Yes** | Paper code |
| `paper_name` | String | No | Paper name |
| `question_no` | String | No | Question number |
| `question_subpart` | String | No | Subpart label |
| `question_content` | String | **Yes** | Question content |
| `marks` | Integer | No | Marks |
| `tags` | String | No | Topic tags |
