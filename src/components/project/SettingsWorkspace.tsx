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
    <div className="module-page settings-surface">
      <header className="module-header">
        <h1>设置</h1>
        <p>管理本机密码与数据备份。密码仅存于本机，导出文件不含密码与会话。</p>
      </header>

      <section className="settings-block">
        <div className="settings-block-head">
          <h2 className="settings-block-title">数据备份</h2>
          <p className="settings-block-desc">导出或导入 JSON 备份，覆盖 projects / tasks / subtasks / timeEntries。</p>
        </div>
        <div className="stack-form settings-block-body">
          <div className="settings-export-row">
            <p className="settings-export-copy">导出本机全部项目、任务与耗时记录为单个 JSON 文件。可离线保存或迁移到其他设备。</p>
            <button type="button" className="secondary-button" disabled={busyBackup} onClick={() => void exportBackup()}>
              {busyBackup ? '导出中…' : '导出备份'}
            </button>
          </div>
          <label className="settings-file-drop">
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
            <span className="settings-file-label">选择备份文件导入</span>
            <span className="settings-file-hint">将解析 JSON 并预览待导入条目，确认在下方进行</span>
          </label>
          {importPreview ? <p className="muted settings-import-preview">{importPreview}</p> : null}
          {backupMsg ? <p className="settings-msg settings-msg-ok">{backupMsg}</p> : null}
          {backupError ? <p className="form-error">{backupError}</p> : null}
        </div>
      </section>

      <hr className="settings-hairline" />

      <section className="settings-block settings-danger-zone">
        <div className="settings-block-head">
          <h2 className="settings-block-title">修改密码</h2>
          <p className="settings-block-desc danger-desc">
            改密会失效现有会话，新设备需重新登录。请确保记住新密码。
          </p>
        </div>
        <form className="stack-form settings-block-body" onSubmit={changePassword}>
          <label className="settings-field-label">
            <span>当前密码</span>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </label>
          <label className="settings-field-label">
            <span>新密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <label className="settings-field-label">
            <span>确认新密码</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
            />
          </label>
          {passwordError ? <p className="form-error">{passwordError}</p> : null}
          {passwordMsg ? <p className="settings-msg settings-msg-ok">{passwordMsg}</p> : null}
          <div className="settings-danger-actions">
            <button className="danger-wash-button" type="submit" disabled={savingPassword}>
              {savingPassword ? '保存中…' : '更新密码'}
            </button>
          </div>
        </form>
      </section>

      <hr className="settings-hairline" />

      <section className="settings-block settings-danger-zone">
        <div className="settings-block-head">
          <h2 className="settings-block-title">确认导入</h2>
          <p className="settings-block-desc danger-desc">
            导入会按 UUID 合并覆盖本地同名记录。先核对预览，再确认。
          </p>
        </div>
        <div className="stack-form settings-block-body">
          {importPayload ? (
            <div className="settings-danger-actions">
              <button
                type="button"
                className="danger-wash-button"
                disabled={busyBackup}
                onClick={() => void confirmImport()}
              >
                {busyBackup ? '导入中…' : '确认导入'}
              </button>
            </div>
          ) : (
            <p className="muted settings-empty">
              <span className="settings-empty-title">等待备份文件</span>
              在上方选择 JSON 文件并确认预览后，「确认导入」按钮会出现在这里。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
