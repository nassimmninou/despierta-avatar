"use client";
import { useState, useEffect } from "react";

export default function Settings() {
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      const response = await fetch("/api/updateSettings", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      console.log("ana hnaya")
      setPrompt(data.prompt);
    };

    fetchSettings();
  }, []);

  const handleChange = (event) => {
    setPrompt(event.target.value);
    console.log("biwiiiwiwi")
  };

  const handleClick = async () => {
    await fetch("/api/updateSettings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });
  };
  return (
    <>
      <label htmlFor="message" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Prompt Editor
      </label>
      <textarea
        value={prompt}
        onChange={handleChange}
        id="message"
        rows="4"
        className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        placeholder="Write your thoughts here..."
      ></textarea>
      <button
        onClick={handleClick}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
      >
        Update
      </button>
    </>
  );
}
