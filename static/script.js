const API_BASE = "";

const jobForm = document.getElementById("jobForm");
const jobList = document.getElementById("jobList");
const filterStatus = document.getElementById("filterStatus");

const totalCount = document.getElementById("totalCount");
const appliedCount = document.getElementById("appliedCount");
const interviewCount = document.getElementById("interviewCount");
const offerCount = document.getElementById("offerCount");

const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

let allJobs = [];

async function fetchJobs() {
  try {
    const res = await fetch(`${API_BASE}/jobs`);
    allJobs = await res.json();
    renderJobs();
    updateStats();
    updateProgress();
  } catch (error) {
    console.error("获取数据失败:", error);
    jobList.innerHTML = `<div class="empty-state">无法连接后端，请先启动 FastAPI 服务。</div>`;
  }
}

async function addJob(jobData) {
  await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jobData),
  });
  fetchJobs();
}

async function deleteJob(jobId) {
  await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: "DELETE",
  });
  fetchJobs();
}

async function updateJobStatus(jobId, newStatus) {
  await fetch(`${API_BASE}/jobs/${jobId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: newStatus }),
  });
  fetchJobs();
}

function renderJobs() {
  const selectedStatus = filterStatus.value;
  let filteredJobs = allJobs;

  if (selectedStatus !== "全部") {
    filteredJobs = allJobs.filter(job => job.status === selectedStatus);
  }

  if (filteredJobs.length === 0) {
    jobList.innerHTML = `<div class="empty-state">暂无符合条件的申请记录</div>`;
    return;
  }

  filteredJobs.sort((a, b) => {
    const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return timeA - timeB;
  });

  jobList.innerHTML = filteredJobs.map(job => {
    const reminderHtml = getDeadlineReminder(job.deadline, job.status);

    return `
      <div class="job-card">
        <div class="job-card-top">
          <div>
            <div class="job-title">${escapeHtml(job.position)}</div>
            <div class="job-company">${escapeHtml(job.company)}</div>
          </div>
          <div class="status-badge status-${job.status}">${job.status}</div>
        </div>

        ${reminderHtml}

        <div class="job-meta">
          <div><strong>投递日期：</strong>${formatDate(job.applied_date)}</div>
          <div><strong>截止日期：</strong>${formatDate(job.deadline)}</div>
          <div><strong>面试时间：</strong>${formatDateTime(job.interview_time)}</div>
          <div><strong>ID：</strong>${job.id}</div>
        </div>

        <div class="job-notes">
          <strong>备注：</strong><br />
          ${job.notes ? escapeHtml(job.notes) : "暂无备注"}
        </div>

        <div class="job-actions">
          <select onchange="handleStatusChange(${job.id}, this.value)">
            ${renderStatusOptions(job.status)}
          </select>
          <button class="delete-btn" onclick="handleDelete(${job.id})">删除</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderStatusOptions(currentStatus) {
  const statusList = ["已收藏", "已投递", "笔试", "面试中", "Offer", "已淘汰"];
  return statusList.map(status =>
    `<option value="${status}" ${status === currentStatus ? "selected" : ""}>${status}</option>`
  ).join("");
}

function updateStats() {
  totalCount.textContent = allJobs.length;
  appliedCount.textContent = allJobs.filter(job => job.status === "已投递").length;
  interviewCount.textContent = allJobs.filter(job => job.status === "面试中").length;
  offerCount.textContent = allJobs.filter(job => job.status === "Offer").length;
}

function updateProgress() {
  if (allJobs.length === 0) {
    progressFill.style.width = "0%";
    progressText.textContent = "0%";
    return;
  }

  const statusScoreMap = {
    "已收藏": 10,
    "已投递": 30,
    "笔试": 50,
    "面试中": 75,
    "Offer": 100,
    "已淘汰": 0
  };

  const totalScore = allJobs.reduce((sum, job) => {
    return sum + (statusScoreMap[job.status] || 0);
  }, 0);

  const percent = Math.round(totalScore / allJobs.length);

  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return "-";
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getDeadlineReminder(deadline, status) {
  if (!deadline) return "";

  if (status === "Offer" || status === "已淘汰") return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  if (isNaN(deadlineDate.getTime())) return "";

  const diffMs = deadlineDate - today;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `<div class="deadline-alert expired">⚠ 该岗位已过截止日期</div>`;
  }

  if (diffDays <= 3) {
    return `<div class="deadline-alert urgent">⚠ 距离截止仅剩 ${diffDays} 天</div>`;
  }

  if (diffDays <= 7) {
    return `<div class="deadline-alert soon">⏰ 距离截止还有 ${diffDays} 天</div>`;
  }

  return "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const jobData = {
    company: document.getElementById("company").value.trim(),
    position: document.getElementById("position").value.trim(),
    applied_date: document.getElementById("appliedDate").value,
    deadline: document.getElementById("deadline").value,
    status: document.getElementById("status").value,
    interview_time: document.getElementById("interviewTime").value,
    notes: document.getElementById("notes").value.trim(),
  };

  await addJob(jobData);
  jobForm.reset();
});

filterStatus.addEventListener("change", renderJobs);

async function handleDelete(id) {
  const confirmed = confirm("确定要删除这条申请记录吗？");
  if (!confirmed) return;
  await deleteJob(id);
}

async function handleStatusChange(id, status) {
  await updateJobStatus(id, status);
}

fetchJobs();