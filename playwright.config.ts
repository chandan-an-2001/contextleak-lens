import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
const systemChrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||(!process.env.PLAYWRIGHT_CHANNEL&&existsSync(systemChrome)?systemChrome:undefined);
export default defineConfig({
  testDir:'./tests',timeout:150000,workers:1,fullyParallel:false,
  expect:{timeout:15000},reporter:'list',
  use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',channel:process.env.PLAYWRIGHT_CHANNEL,launchOptions:{executablePath},headless:true,viewport:{width:1440,height:1000},trace:'retain-on-failure'},
  webServer:{command:'npm run preview -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:true,timeout:30000},
});
