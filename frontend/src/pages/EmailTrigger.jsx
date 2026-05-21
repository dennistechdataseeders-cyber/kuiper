import React, {
  useState
} from 'react';

import axios from 'axios';

import * as XLSX from 'xlsx';

import {
  Upload,
  CalendarDays,
  CheckCircle2,
  Mail
} from 'lucide-react';

import API_BASE_URL from '../config';

const EmailTrigger = () => {

  /*
  ========================================
  STATES
  ========================================
  */

  const [file, setFile] =
    useState(null);

  const [templateId, setTemplateId] =
    useState('welcome');

  const [previewData, setPreviewData] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState('');

  /*
  ========================================
  TEMPLATE OPTIONS
  ========================================
  */

  const templates = [

  {
    id: 'welcome',
    name: 'Welcome Sales Sequence'
  }

];

  /*
  ========================================
  FILE CHANGE
  ========================================
  */

  const handleFileChange = (e) => {

    try {

      const selectedFile =
        e.target.files[0];

      if (!selectedFile) return;

      setFile(selectedFile);

      const reader =
        new FileReader();

      reader.onload = (evt) => {

        const data =
          new Uint8Array(
            evt.target.result
          );

        const workbook =
          XLSX.read(data, {
            type: 'array'
          });

        const sheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ];

        const json =
          XLSX.utils.sheet_to_json(
            sheet
          );

        setPreviewData(json);

      };

      reader.readAsArrayBuffer(
        selectedFile
      );

    } catch (error) {

      console.error(error);

      alert(
        'Failed to read excel file'
      );

    }

  };

  /*
  ========================================
  UPLOAD CAMPAIGN
  ========================================
  */

  const handleUpload =
    async () => {

      try {

        if (!file) {

          return alert(
            'Please upload an excel file'
          );

        }

        setLoading(true);

        setSuccess('');

        const token =
          localStorage.getItem('token');

        const formData =
          new FormData();

        formData.append(
          'file',
          file
        );

        formData.append(
          'templateId',
          templateId
        );

        const response =
          await axios.post(

            `${API_BASE_URL}/api/email-campaign/upload`,

            formData,

            {
              headers: {

                Authorization:
                  `Bearer ${token}`,

                'Content-Type':
                  'multipart/form-data'

              }
            }

          );

        setSuccess(
          `Campaign scheduled successfully for ${response.data.count} recipients`
        );

        alert(
          'Campaign Scheduled Successfully'
        );

      } catch (error) {

        console.error(
          'UPLOAD ERROR:',
          error
        );

        alert(
          error?.response?.data?.error ||
          'Failed to schedule campaign'
        );

      } finally {

        setLoading(false);

      }

    };

  return (

    <div className="ml-64 min-h-screen bg-slate-50 p-8">

      {/* ========================================
          HEADER
      ======================================== */}

      <div className="mb-8">

        <div className="flex items-center gap-4">

          <div className="h-16 w-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-lg">

            <Mail
              size={28}
              className="text-white"
            />

          </div>

          <div>

            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Email Trigger
            </h1>

            <p className="text-xs uppercase tracking-[0.35em] text-blue-600 font-black mt-2">
              Zoho Mail Drip Campaign System
            </p>

          </div>

        </div>

      </div>

      {/* ========================================
          SUCCESS ALERT
      ======================================== */}

      {success && (

        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex items-center gap-3">

          <CheckCircle2
            className="text-emerald-600"
            size={22}
          />

          <p className="font-bold text-emerald-700">
            {success}
          </p>

        </div>

      )}

      {/* ========================================
          MAIN CARD
      ======================================== */}

      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ========================================
              FILE UPLOAD
          ======================================== */}

          <div>

            <label className="text-xs uppercase tracking-widest font-black text-slate-500">
              Upload Excel File
            </label>

            <label className="mt-3 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-[2rem] p-10 cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition-all">

              <Upload
                size={42}
                className="text-blue-600 mb-4"
              />

              <p className="font-black text-slate-800 text-lg">
                Click to Upload
              </p>

              <p className="text-sm text-slate-500 mt-2 text-center">
                Excel should contain:
                <br />
                <span className="font-bold">
                  Name, Email
                </span>
              </p>

              {file && (

                <div className="mt-4 bg-blue-100 text-blue-700 px-4 py-2 rounded-2xl text-sm font-bold">

                  {file.name}

                </div>

              )}

              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

            </label>

          </div>

          {/* ========================================
              TEMPLATE SELECT
          ======================================== */}

          <div>

            <label className="text-xs uppercase tracking-widest font-black text-slate-500">
              Select Template
            </label>

            <select
              value={templateId}
              onChange={(e) =>
                setTemplateId(
                  e.target.value
                )
              }
              className="mt-3 w-full h-16 rounded-3xl border border-slate-200 px-5 font-bold text-slate-700 bg-white outline-none focus:border-blue-500"
            >

              {templates.map(
                (template) => (

                  <option
                    key={template.id}
                    value={template.id}
                  >
                    {template.name}
                  </option>

                )
              )}

            </select>

            {/* DRIP INFO */}

            <div className="mt-5 bg-slate-100 rounded-3xl p-5">

              <p className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">
                Drip Schedule
              </p>

              <div className="space-y-2 text-sm font-semibold text-slate-700">

                <div>Step 1 → Day 0</div>
                <div>Step 2 → Day +2</div>
                <div>Step 3 → Day +5</div>
                <div>Step 4 → Day +12</div>
                <div>Step 5 → Day +22</div>
                <div>Step 6 → Day +37</div>

              </div>

            </div>

          </div>

          {/* ========================================
              SUBMIT
          ======================================== */}

          <div className="flex flex-col justify-end">

            <button
              onClick={handleUpload}
              disabled={
                !file || loading
              }
              className="
                h-16
                rounded-3xl
                bg-blue-600
                hover:bg-blue-700
                disabled:bg-slate-300
                text-white
                font-black
                text-sm
                uppercase
                tracking-widest
                flex
                items-center
                justify-center
                gap-3
                shadow-lg
                shadow-blue-900/20
                transition-all
              "
            >

              <CalendarDays size={20} />

              {
                loading
                  ? 'Scheduling Campaign...'
                  : 'Set Schedule'
              }

            </button>

          </div>

        </div>

      </div>

      {/* ========================================
          PREVIEW TABLE
      ======================================== */}

      {previewData.length > 0 && (

        <div className="mt-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">

          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">

            <div>

              <h2 className="text-2xl font-black text-slate-900">
                Excel Preview
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                {previewData.length} recipients detected
              </p>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-slate-100">

                <tr>

                  <th className="px-8 py-5 text-left text-xs uppercase tracking-widest font-black text-slate-500">
                    Name
                  </th>

                  <th className="px-8 py-5 text-left text-xs uppercase tracking-widest font-black text-slate-500">
                    Email
                  </th>

                </tr>

              </thead>

              <tbody>

                {previewData.map(
                  (item, index) => (

                    <tr
                      key={index}
                      className="border-t border-slate-100 hover:bg-slate-50 transition-all"
                    >

                      <td className="px-8 py-5 font-bold text-slate-800">
                        {item.Name}
                      </td>

                      <td className="px-8 py-5 text-slate-600">
                        {item.Email}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </div>

      )}

    </div>

  );

};

export default EmailTrigger;