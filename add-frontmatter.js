#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function addFrontMatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 이미 front matter가 있으면 스킵
  if (content.startsWith('---')) {
    return;
  }
  
  const fileName = path.basename(filePath, '.md');
  const title = fileName
    .replace(/^\d+-/, '') // 숫자 접두사 제거
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  const frontMatter = `---
layout: default
title: ${title}
---

`;
  
  const newContent = frontMatter + content;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Added front matter to: ${filePath}`);
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      processDirectory(filePath);
    } else if (file.endsWith('.md') && file !== 'README.md' && file !== 'index.md') {
      addFrontMatter(filePath);
    }
  }
}

processDirectory('.');
