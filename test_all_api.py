import urllib.request
import json

BASE = "http://localhost:5173/api"

def req(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# 登录
token = req("POST", "/auth/login", {"username": "admin", "password": "123456"})["data"]["token"]
h = lambda m, p, b=None: req(m, p, b, token)

print("=== API 全面测试 ===\n")

# 1. 首页仪表盘
print("1. 首页仪表盘")
r = h("GET", "/dashboard/overview")
print(f"   GET /dashboard/overview: {'OK' if r.get('success') else 'FAIL - ' + str(r.get('error'))}")

# 2. 战略管理
print("\n2. 战略管理")
r = h("GET", "/strategies?limit=10")
items = r.get("data", {}).get("items", [])
print(f"   GET /strategies: OK ({len(items)} items)")

r = h("POST", "/strategies", {"title": "测试战略", "year": 2026, "startDate": "2026-01-01", "endDate": "2026-12-31"})
if r.get("success"):
    sid = r["data"]["id"]
    print(f"   POST /strategies: OK (id={sid[:8]}...)")
    r2 = h("PUT", f"/strategies/{sid}", {"title": "已修改战略"})
    print(f"   PUT /strategies/:id: {'OK' if r2.get('success') else 'FAIL'}")
    r3 = h("GET", f"/strategies/{sid}")
    print(f"   GET /strategies/:id: {'OK' if r3.get('success') else 'FAIL'}")
    r4 = h("DELETE", f"/strategies/{sid}")
    print(f"   DELETE /strategies/:id: {'OK' if r4.get('success') else 'FAIL'}")
else:
    print(f"   POST /strategies: FAIL - {r.get('error')}")

# 3. 计划管理
print("\n3. 计划管理")
r = h("GET", "/plans?limit=10")
items = r.get("data", {}).get("items", [])
print(f"   GET /plans: OK ({len(items)} items)")

r = h("POST", "/plans", {"title": "测试计划", "type": "department", "startDate": "2026-01-01", "endDate": "2026-06-30"})
if r.get("success"):
    pid = r["data"]["id"]
    print(f"   POST /plans: OK")
    r2 = h("PUT", f"/plans/{pid}", {"title": "已修改计划"})
    print(f"   PUT /plans/:id: {'OK' if r2.get('success') else 'FAIL'}")
    r4 = h("DELETE", f"/plans/{pid}")
    print(f"   DELETE /plans/:id: {'OK' if r4.get('success') else 'FAIL'}")
else:
    print(f"   POST /plans: FAIL - {r.get('error')}")

# 4. 任务管理
print("\n4. 任务管理")
r = h("GET", "/tasks-v2?limit=10")
items = r.get("data", {}).get("items", [])
print(f"   GET /tasks-v2: OK ({len(items)} items)")

r = h("GET", "/tasks-v2/my")
print(f"   GET /tasks-v2/my: {'OK' if r.get('success') else 'FAIL - ' + str(r.get('error'))}")

r = h("POST", "/tasks-v2", {"title": "测试任务", "dueDate": "2026-04-30", "sourceType": "assigned"})
if r.get("success"):
    tid = r["data"]["id"]
    print(f"   POST /tasks-v2: OK")
    r2 = h("PUT", f"/tasks-v2/{tid}", {"title": "已修改任务"})
    print(f"   PUT /tasks-v2/:id: {'OK' if r2.get('success') else 'FAIL'}")
    r3 = h("POST", f"/tasks-v2/{tid}/progress", {"progress": 50, "result": "完成50%"})
    print(f"   POST /tasks-v2/:id/progress: {'OK' if r3.get('success') else 'FAIL'}")
    r4 = h("DELETE", f"/tasks-v2/{tid}")
    print(f"   DELETE /tasks-v2/:id: {'OK' if r4.get('success') else 'FAIL'}")
else:
    print(f"   POST /tasks-v2: FAIL - {r.get('error')}")

# 5. 考核管理
print("\n5. 考核管理")
r = h("POST", "/assessments", {"userId": "user-emp1", "assessorId": "user-ceo", "type": "monthly", "period": "2026-04", "score": 85})
if r.get("success"):
    aid = r["data"]["id"]
    print(f"   POST /assessments: OK")
    r2 = h("PUT", f"/assessments/{aid}", {"score": 90})
    print(f"   PUT /assessments/:id: {'OK' if r2.get('success') else 'FAIL'}")
    r4 = h("DELETE", f"/assessments/{aid}")
    print(f"   DELETE /assessments/:id: {'OK' if r4.get('success') else 'FAIL'}")
else:
    print(f"   POST /assessments: FAIL - {r.get('error')}")

# 6. 问题清单
print("\n6. 问题清单")
r = h("POST", "/issues", {"source": "测试", "discoveryDate": "2026-04-10", "departmentId": "dept-ops", "description": "测试问题", "issueType": "其他", "severity": "中"})
if r.get("success"):
    iid = r["data"]["id"]
    print(f"   POST /issues: OK")
    r2 = h("PUT", f"/issues/{iid}", {"description": "已修改问题"})
    print(f"   PUT /issues/:id: {'OK' if r2.get('success') else 'FAIL'}")
    r4 = h("DELETE", f"/issues/{iid}")
    print(f"   DELETE /issues/:id: {'OK' if r4.get('success') else 'FAIL'}")
else:
    print(f"   POST /issues: FAIL - {r.get('error')}")

# 7. 周报管理
print("\n7. 周报管理")
r = h("POST", "/weekly-reports", {"weekDate": "2026-04-07", "departmentId": "dept-ops", "completedTasks": "测试", "keyData": "100", "nextWeekPlan": "继续", "selfEvaluation": "达成"})
if r.get("success"):
    rid = r["data"]["id"]
    print(f"   POST /weekly-reports: OK")
    r2 = h("PUT", f"/weekly-reports/{rid}", {"completedTasks": "已修改"})
    print(f"   PUT /weekly-reports/:id: {'OK' if r2.get('success') else 'FAIL'}")
    r4 = h("DELETE", f"/weekly-reports/{rid}")
    print(f"   DELETE /weekly-reports/:id: {'OK' if r4.get('success') else 'FAIL'}")
else:
    print(f"   POST /weekly-reports: FAIL - {r.get('error')}")

# 8. 部门管理
print("\n8. 部门管理")
r = h("GET", "/departments/list")
depts = r.get("data", [])
print(f"   GET /departments/list: OK ({len(depts)} depts)")

r = h("POST", "/departments", {"name": "测试部门", "description": "测试"})
if r.get("success"):
    did = r["data"]["id"]
    print(f"   POST /departments: OK")
    r2 = h("PUT", f"/departments/{did}", {"name": "已修改部门"})
    print(f"   PUT /departments/:id: {'OK' if r2.get('success') else 'FAIL'}")
    r4 = h("DELETE", f"/departments/{did}")
    print(f"   DELETE /departments/:id: {'OK' if r4.get('success') else 'FAIL'}")
else:
    print(f"   POST /departments: FAIL - {r.get('error')}")

# 9. 用户管理
print("\n9. 用户管理")
r = h("GET", "/users?limit=10")
items = r.get("data", {}).get("items", [])
print(f"   GET /users: OK ({len(items)} users)")

# 10. 前端HTML
print("\n10. 前端页面")
r = req("GET", "/")
print(f"   GET / (HTML): {'OK' if '<!doctype' in r else 'FAIL'}")

r = req("GET", "/health")
print(f"   GET /api/health: {'OK' if r.get('status') == 'ok' else 'FAIL'}")

print("\n=== 测试完成 ===")
