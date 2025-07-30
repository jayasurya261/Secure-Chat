import React from 'react';

const FileUploader = ({ onFileSend }) => {
  const handleChange = (event) => {
    const file = event.target.files[0];

    if (file) {
      onFileSend(file);
      // Reset the input so the same file can be reselected later
      event.target.value = '';
    }
  };

  return (
    <div className="mt-4">
      <label
        className="bg-green-500 text-white px-4 py-2 rounded-xl cursor-pointer hover:bg-green-600 transition"
      >
        Upload File
        <input
          type="file"
          onChange={handleChange}
          className="hidden"
        />
      </label>
    </div>
  );
};

export default FileUploader;
