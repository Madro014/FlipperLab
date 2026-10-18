import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'**/browser.spec.js',use:{baseURL:'http://127.0.0.1:5180',channel:'msedge'},workers:1});
