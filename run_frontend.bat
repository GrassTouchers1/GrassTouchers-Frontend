@echo off
rem Copyright 2026 GrassTouchers Team
rem
rem Licensed under the Apache License, Version 2.0 (the "License");
rem you may not use this file except in compliance with the License.
rem You may obtain a copy of the License at
rem
rem     http://www.apache.org/licenses/LICENSE-2.0
rem
rem Unless required by applicable law or agreed to in writing, software
rem distributed under the License is distributed on an "AS IS" BASIS,
rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
rem See the License for the specific language governing permissions and
rem limitations under the License.

chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo [GrassToucher] Khoi chay Frontend Web PWA (Port 3000)
echo 100%% Ma nguon mo (Open Source / Apache-2.0 License)
echo ========================================================
echo Mo trinh duyet tai: http://localhost:3000
echo Cổng Dân Sự:       http://localhost:3000/citizen.html
echo ========================================================
if exist "..\GrassToucher-backend\venv\Scripts\python.exe" (
    "..\GrassToucher-backend\venv\Scripts\python.exe" -m http.server 3000
) else (
    python -m http.server 3000
)
pause
