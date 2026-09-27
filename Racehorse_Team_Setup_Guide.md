# Racehorse Training & Management System --- TEAM SETUP GUIDE

> Mục đích: giúp thành viên mới tự cài đặt và chạy project trên Windows
> theo đúng môi trường team đã sử dụng.

## 1. Stack

-   Frontend: React + TypeScript + Vite
-   Backend: NestJS + TypeScript
-   Database: PostgreSQL 17
-   ORM: Prisma
-   Local database: Docker Desktop
-   IDE: VS Code
-   Git: GitHub + GitHub Desktop

Cấu trúc:

``` text
Racehorse-Training-Management-System/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # React + Vite frontend
├── demo/
├── docs/
├── scripts/
├── docker-compose.yml
├── README.md
└── TEAM_RULES.md
```

  Thành phần        Port
  --------------- ------
  Frontend          5173
  Backend API       3000
  PostgreSQL        5432
  Prisma Studio     5555

URLs:

``` text
Frontend: http://localhost:5173
API:      http://localhost:3000/api/v1
Swagger:  http://localhost:3000/api/docs
Health:   http://localhost:3000/api/v1/health
```

------------------------------------------------------------------------

# 2. Cài phần mềm

Cần:

-   Git
-   Node.js **24.x**
-   npm
-   Docker Desktop
-   VS Code
-   Prisma extension (khuyến nghị)
-   ESLint + Prettier extension (khuyến nghị)

Kiểm tra:

``` powershell
git --version
node --version
npm --version
docker --version
docker compose version
```

Môi trường đã dùng để setup:

``` text
Git 2.55.0
Node v24.21.0
npm 11.19.0
Docker 29.8.0
Docker Compose v5.5.1
```

Nếu PowerShell chặn npm script:

``` powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

------------------------------------------------------------------------

# 3. Clone repository

Nên đặt project ở thư mục đơn giản, ví dụ:

``` text
C:\Dev\Racehorse-Training-Management-System
```

Clone:

``` powershell
cd C:\Dev
git clone <REPO-URL> Racehorse-Training-Management-System
cd Racehorse-Training-Management-System
```

Cài dependency:

``` powershell
cd apps/api
npm install

cd ../web
npm install
```

## Lưu ý quan trọng về Windows

Trong quá trình setup thực tế, repository đặt trong `Documents` gặp lỗi
không ghi được `.env` và file test mặc dù có quyền đọc.

Nếu gặp lỗi kiểu:

``` text
Access denied
FileNotFoundException
Cannot create/write .env
```

hãy chuyển repository sang:

``` text
C:\Dev\
```

Không cần tự ý thay đổi ACL của cả thư mục `Documents`.

------------------------------------------------------------------------

# 4. Docker + WSL2

Docker Desktop trên Windows cần WSL2.

Nếu Docker báo WSL chưa được cài:

1.  Mở PowerShell bằng **Run as administrator**.
2.  Chạy:

``` powershell
wsl --install
```

3.  Restart Windows nếu được yêu cầu.
4.  Mở Docker Desktop.
5.  Kiểm tra:

``` powershell
docker info
```

Nếu Docker Engine hiện thông tin Server bình thường thì Docker đã sẵn
sàng.

------------------------------------------------------------------------

# 5. Start PostgreSQL

Từ root project:

``` powershell
cd C:\Dev\Racehorse-Training-Management-System
docker compose up -d db
```

Kiểm tra:

``` powershell
docker ps
```

Database dùng:

``` text
Host:     localhost
Port:     5432
Database: racehorse
User:     postgres
Password: postgres
```

Docker volume được dùng để giữ dữ liệu local.

Dừng database:

``` powershell
docker compose stop db
```

Chạy lại:

``` powershell
docker compose start db
```

> **Không chạy `docker compose down -v` tùy tiện**, vì `-v` có thể xóa
> database volume.

------------------------------------------------------------------------

# 6. Nếu port 5432 bị xung đột

Đây là lỗi đã gặp trong quá trình setup.

Kiểm tra:

``` powershell
netstat -ano | findstr ":5432"
```

Nếu có process khác ngoài Docker đang LISTEN trên 5432, kiểm tra:

``` powershell
Get-Process -Id <PID>
```

Có thể kiểm tra PostgreSQL Windows:

``` powershell
Get-Service | Where-Object {$_.Name -like "*postgres*" -or $_.DisplayName -like "*postgres*"} | Format-Table Name,DisplayName,Status,StartType
```

Trong máy setup thực tế có service:

``` text
postgresql-x64-17
```

Nếu PostgreSQL Windows không được dùng cho project và đang chiếm port
5432, mở **PowerShell as Administrator** rồi:

``` powershell
Stop-Service -Name "postgresql-x64-17"
```

Kiểm tra lại:

``` powershell
netstat -ano | findstr ":5432"
```

Không kill PostgreSQL process bằng tay trước khi xác định nó thuộc
service nào.

------------------------------------------------------------------------

# 7. Tạo `.env`

Đi vào backend:

``` powershell
cd C:\Dev\Racehorse-Training-Management-System\apps\api
```

Copy file:

``` powershell
Copy-Item ".env.example" ".env"
```

Kiểm tra:

``` powershell
Get-ChildItem -Force .env*
```

`DATABASE_URL` phải tương ứng với Docker PostgreSQL:

``` env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/racehorse?schema=public
```

Các giá trị JWT/SMTP mẫu trong `.env.example` có thể giữ nguyên cho
local development nếu project không yêu cầu credentials thật.

------------------------------------------------------------------------

# 8. Prisma

Generate client:

``` powershell
npm run prisma:generate
```

Migration:

``` powershell
npm run prisma:migrate
```

Thành công khi có:

``` text
Your database is now in sync with your schema.
```

Prisma hiện dùng version 6.19.3 trong project.

Nếu thấy warning:

``` text
package.json#prisma is deprecated in Prisma 7
```

đó là **warning**, không phải lỗi. Không tự ý nâng Prisma.

## Các migration hiện có trong database setup

``` text
20260908032635_init
20260914104850_phase6_pedigree_races
20260914112940_phase7_training_plan_lock
20260914113952_phase8_incidents_notifications
20260924090416_phase9_fitness_warning_notification
20260925003525_phase10_health_injury_extensions
```

Không xóa migration hoặc reset database khi chưa trao đổi với team.

------------------------------------------------------------------------

# 9. Seed database

Chạy:

``` powershell
npm run db:seed
```

Seed hiện tạo dữ liệu demo cho:

-   Users / roles
-   Horses
-   Training sessions
-   Health records
-   Pedigree
-   Races / race entries
-   Training plans
-   Incidents / notifications
-   Vaccinations
-   Injuries
-   Treatment plans / medications

## Demo accounts

  Role      Email                       Password
  --------- --------------------------- ---------------
  MANAGER   `manager@racehorse.local`   `Manager123!`
  TRAINER   `trainer@racehorse.local`   `Trainer123!`
  VET       `vet@racehorse.local`       `Vet123!`
  GROOM     `groom@racehorse.local`     `Groom123!`
  OWNER     `owner1@racehorse.local`    `Owner123!`
  OWNER     `owner2@racehorse.local`    `Owner123!`
  PENDING   `newbie@racehorse.local`    `Newbie123!`

Đây là tài khoản local demo, không dùng cho production.

------------------------------------------------------------------------

# 10. Nếu seed báo lỗi bcrypt

Lỗi đã gặp:

``` text
Cannot find module ...\node_modules\bcrypt\lib\binding\napi-v3\bcrypt_lib.node
```

Fix:

``` powershell
npm rebuild bcrypt
```

Nếu hiện:

``` text
rebuilt dependencies successfully
```

chạy lại:

``` powershell
npm run db:seed
```

Không cần reset database chỉ vì lỗi native `bcrypt`.

------------------------------------------------------------------------

# 11. Chạy Backend

Từ:

``` text
apps/api
```

chạy:

``` powershell
npm run start:dev
```

Thành công khi có:

``` text
Nest application successfully started
```

và:

``` text
API on http://localhost:3000/api/v1
docs at /api/docs
```

**Giữ terminal backend mở.**

------------------------------------------------------------------------

# 12. Test Backend + Database

Mở PowerShell mới:

``` powershell
Invoke-WebRequest http://localhost:3000/api/v1/health -UseBasicParsing
```

Kết quả đúng:

``` json
{"status":"ok","db":"up","time":"..."}
```

Trong đó:

``` text
status = ok
db     = up
```

xác nhận NestJS đang chạy và kết nối được PostgreSQL.

------------------------------------------------------------------------

# 13. Swagger

Mở:

``` text
http://localhost:3000/api/docs
```

Login API:

``` text
POST /auth/login
```

Sau khi login lấy `accessToken`, dùng nút **Authorize** của Swagger để
test endpoint cần authentication.

------------------------------------------------------------------------

# 14. Chạy Frontend

Mở PowerShell mới:

``` powershell
cd C:\Dev\Racehorse-Training-Management-System\apps\web
npm run dev
```

Thành công:

``` text
VITE ready
Local: http://localhost:5173/
```

Mở:

``` text
http://localhost:5173
```

Route login:

``` text
http://localhost:5173/login
```

Đăng nhập thử bằng:

``` text
manager@racehorse.local
Manager123!
```

Nếu vào `/horses` và thấy danh sách horse từ database, frontend →
backend → database đã hoạt động.

------------------------------------------------------------------------

# 15. Prisma Studio

Nếu cần xem database:

``` powershell
cd apps/api
npm run prisma:studio
```

Mở:

``` text
http://localhost:5555
```

Không dùng Prisma Studio để tự ý thay đổi schema thay cho migration.

------------------------------------------------------------------------

# 16. Tests

Backend unit tests:

``` powershell
cd apps/api
npm test
```

E2E:

``` powershell
npm run test:e2e
```

Mỗi feature cần được test trước khi tạo Pull Request.

------------------------------------------------------------------------

# 17. Daily Startup

Không cần chạy lại migration/seed mỗi ngày.

## Terminal 1 --- Database

Mở Docker Desktop.

``` powershell
cd C:\Dev\Racehorse-Training-Management-System
docker compose up -d db
```

## Terminal 2 --- Backend

``` powershell
cd C:\Dev\Racehorse-Training-Management-System\apps\api
npm run start:dev
```

## Terminal 3 --- Frontend

``` powershell
cd C:\Dev\Racehorse-Training-Management-System\apps\web
npm run dev
```

Browser:

``` text
http://localhost:5173
```

------------------------------------------------------------------------

# 18. Git workflow của team

Team sử dụng **feature branch + Pull Request**.

Không push trực tiếp vào `main`.

Workflow:

``` text
Pull
  ↓
Create Branch
  ↓
Code
  ↓
Test
  ↓
Commit
  ↓
Push
  ↓
Pull Request
  ↓
Review
  ↓
Merge
```

Trước khi bắt đầu task:

``` powershell
git switch main
git pull
```

Tạo branch:

``` powershell
git switch -c feature/<ten-feature>
```

Ví dụ:

``` powershell
git switch -c feature/training-plan
```

Sau khi code:

``` powershell
git status
git add .
git commit -m "feat: add training plan flow"
git push -u origin feature/training-plan
```

Sau đó tạo Pull Request.

------------------------------------------------------------------------

# 19. Team coordination

Team có 3 thành viên phụ trách 3 flow và một thành viên phụ trách quản
lý API. Team lead điều phối các phần này.

Các phần **không tự ý thay đổi** nếu ảnh hưởng đến flow khác:

-   Prisma schema
-   Database model
-   Migration
-   API endpoint
-   Request/response DTO
-   Authentication / authorization
-   Shared types
-   Shared components
-   Docker configuration
-   `.env` structure
-   API contract

Nếu feature cần API mới:

``` text
Feature owner
      ↓
Thống nhất API contract
      ↓
API manager
      ↓
Backend
      ↓
Database
```

Mục tiêu là tránh việc một thành viên đổi API làm hỏng flow của thành
viên khác.

------------------------------------------------------------------------

# 20. Quy tắc khi nhận task

Mỗi thành viên:

1.  Pull code mới nhất.
2.  Tạo feature branch riêng.
3.  Kiểm tra flow/source code hiện tại trước khi sửa.
4.  Không tự ý thay đổi kiến trúc.
5.  Không tự ý đổi database schema nếu task không yêu cầu.
6.  Test feature local.
7.  Commit rõ ràng.
8.  Push branch.
9.  Tạo Pull Request.
10. Chờ review trước khi merge.

Nếu task phụ thuộc API chưa tồn tại, trao đổi với API manager trước.

------------------------------------------------------------------------

# 21. Khi pull migration mới

Nếu thành viên khác merge migration vào `main`:

``` powershell
git switch main
git pull
```

Sau đó:

``` powershell
cd apps/api
npm run prisma:migrate
```

Nếu cần:

``` powershell
npm run prisma:generate
```

Sau đó restart backend.

Không chạy reset database trừ khi team lead yêu cầu.

------------------------------------------------------------------------

# 22. Troubleshooting nhanh

## `P1000 Authentication failed`

Kiểm tra:

``` powershell
docker ps
netstat -ano | findstr ":5432"
```

Nếu có PostgreSQL Windows chiếm port:

``` powershell
Get-Service | Where-Object {$_.Name -like "*postgres*"}
```

Nếu service không cần:

``` powershell
# PowerShell as Administrator
Stop-Service -Name "postgresql-x64-17"
```

Sau đó chạy lại:

``` powershell
npm run prisma:migrate
```

------------------------------------------------------------------------

## `.env` không tạo được

Chuyển project khỏi `Documents` sang:

``` text
C:\Dev\Racehorse-Training-Management-System
```

rồi:

``` powershell
Copy-Item ".env.example" ".env"
```

------------------------------------------------------------------------

## `bcrypt_lib.node` missing

``` powershell
npm rebuild bcrypt
npm run db:seed
```

------------------------------------------------------------------------

## Frontend chạy nhưng không login được

Kiểm tra backend:

``` powershell
Invoke-WebRequest http://localhost:3000/api/v1/health -UseBasicParsing
```

Phải trả:

``` json
{"status":"ok","db":"up"}
```

Sau đó kiểm tra backend terminal có đang chạy không.

------------------------------------------------------------------------

## `npm install` gặp dependency issue

Kiểm tra:

``` powershell
node --version
npm --version
```

Không tự ý chạy:

``` powershell
npm audit fix --force
```

vì có thể thay đổi dependency/lockfile của project.

------------------------------------------------------------------------

# 23. Final checklist cho thành viên mới

-   [ ] Git installed
-   [ ] Node.js 24.x installed
-   [ ] Docker Desktop installed
-   [ ] WSL2 hoạt động
-   [ ] Repository cloned
-   [ ] `apps/api` → `npm install`
-   [ ] `apps/web` → `npm install`
-   [ ] Docker PostgreSQL running
-   [ ] `.env` created
-   [ ] `DATABASE_URL` đúng
-   [ ] `npm run prisma:generate`
-   [ ] `npm run prisma:migrate`
-   [ ] `npm run db:seed`
-   [ ] Backend starts
-   [ ] `/api/v1/health` trả `status: ok`
-   [ ] `db: up`
-   [ ] Swagger opens
-   [ ] Frontend starts
-   [ ] Login works
-   [ ] `/horses` loads demo data

------------------------------------------------------------------------

# 24. Expected architecture

``` text
                         GitHub
                            │
                            ▼
              Racehorse-Training-Management-System
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
        apps/web                       apps/api
     React + Vite                   NestJS + TS
        :5173                          :3000
             │                             │
             │          HTTP API            │
             └────────────────────────────►│
                                           │
                                         Prisma
                                           │
                                           ▼
                                  PostgreSQL 17
                                    Docker :5432
                                           │
                                           ▼
                                    racehorse DB
```

------------------------------------------------------------------------

# 25. Khi setup thành viên gặp lỗi

Đừng chỉ gửi:

``` text
"Em bị lỗi"
```

Hãy gửi:

1.  Command đã chạy.
2.  Full output/error.
3.  `node --version`
4.  `docker --version`
5.  `docker ps` nếu liên quan database.
6.  Screenshot nếu liên quan frontend.

Điều này giúp team lead/API manager xác định lỗi nhanh hơn và tránh mỗi
người tự sửa một kiểu.
