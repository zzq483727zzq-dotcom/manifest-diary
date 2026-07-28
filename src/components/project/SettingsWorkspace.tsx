'use client';

import { useState } from 'react';

export function SettingsWorkspace() {
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [importPreview, setImportPreview] = useState('');
  const [importPayload, setImportPayload] = useState<unknown>(null);
  const [backupMsg, setBackupMsg] = useState('');
  const [backupError, setBackupError] = useState('');
  const [busyBackup, setBusyBackup] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError('');
    setPasswordMsg('');
    if (password.length < 6) {
      setPasswordError('新密码至少 6 位');
      return;
    }
    if (password !== confirm) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/local-auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oldPassword, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '修改失败');
      setOldPassword('');
      setPassword('');
      setConfirm('');
      setPasswordMsg('密码已更新');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setSavingPassword(false);
    }
  }

  async function exportBackup() {
    setBusyBackup(true);
    setBackupError('');
    setBackupMsg('');
    try {
      const res = await fetch('/api/backup/export');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '导出失败');
      const blob = new Blob([JSON.stringify(body.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clarity-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg('备份已下载');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setBusyBackup(false);
    }
  }

  async function onPickFile(file: File | null) {
    setBackupError('');
    setBackupMsg('');
    setImportPreview('');
    setImportPayload(null);
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as {
        version?: number;
        projects?: unknown[];
        tasks?: unknown[];
        subtasks?: unknown[];
        timeEntries?: unknown[];
      };
      if (json.version !== 1) throw new Error('备份版本不支持');
      setImportPayload(json);
      setImportPreview(
        `将导入 项目 ${json.projects?.length ?? 0} / 任务 ${json.tasks?.length ?? 0} / 子任务 ${json.subtasks?.length ?? 0} / 耗时 ${json.timeEntries?.length ?? 0}`,
      );
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : '文件无法解析');
    }
  }

  async function confirmImport() {
    if (!importPayload) return;
    if (!window.confirm('导入会按 UUID 合并更新，本地多余数据会保留。确定继续？')) return;
    setBusyBackup(true);
    setBackupError('');
    setBackupMsg('');
    try {
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ backup: importPayload }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '导入失败');
      setBackupMsg(
        `导入完成：项目 ${body.counts.projects} / 任务 ${body.counts.tasks} / 子任务 ${body.counts.subtasks} / 耗时 ${body.counts.timeEntries}`,
      );
      setImportPayload(null);
      setImportPreview('');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setBusyBackup(false);
    }
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div className="eyebrow">设置 · SETTINGS</div>
        <h1>本地密码与数据备份。</h1>
        <p>密码只存在本机。导出不会包含密码和会话。</p>
      </header>

      <div className="settings-grid">
        <article className="life-card">
          <div className="eyebrow">安全</div>
          <h2 style={{ fontSize: 20, margin: '10px 0 16px' }}>修改密码</h2>
          <form className="stack-form" onSubmit={changePassword}>
            <label>
              当前密码
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </label>
            <label>
              新密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label>
              确认新密码
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
              />
            </label>
            {passwordError ? <p className="form-error">{passwordError}</p> : null}
            {passwordMsg ? <p className="muted">{passwordMsg}</p> : null}
            <button className="primary-button" type="submit" disabled={savingPassword}>
              {savingPassword ? '保存中…' : '更新密码'}
            </button>
          </form>
        </article>

        <article className="life-card">
          <div className="eyebrow">备份</div>
          <h2 style={{ fontSize: 20, margin: '10px 0 16px' }}>JSON 导出 / 导入</h2>
          <div className="stack-form">
            <p className="muted">导出内容包含 projects / tasks / subtasks / timeEntries。</p>
            <button type="button" className="secondary-button" disabled={busyBackup} onClick={() => void exportBackup()}>
              导出备份
            </button>
            <label>
              选择备份文件
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {importPreview ? <p className="muted">{importPreview}</p> : null}
            {importPayload ? (
              <button type="button" className="primary-button" disabled={busyBackup} onClick={() => void confirmImport()}>
                确认导入
              </button>
            ) : null}
            {backupError ? <p className="form-error">{backupError}</p> : null}
            {backupMsg ? <p className="muted">{backupMsg}</p> : null}
          </div>
        </article>
      </div>
    </div>
  );
}
