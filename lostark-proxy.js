/*@cc_on
@if (@_jscript)
  var fso = WScript.CreateObject('Scripting.FileSystemObject'),
      shell = WScript.CreateObject('WScript.Shell'),
      cwd = WScript.ScriptFullName.split('\\'),
      file,
      out,
      msg,
      version;
  cwd.pop();
  cwd = cwd.join('\\') + '\\';
  version = cwd + '__nodeversion';
  try {
    shell.Run('cmd /c node --version > "' + version + '"', 0, true);
    file = fso.OpenTextFile(version, 1);
    out = file.ReadAll();
    file.Close();
    file = null;
    fso.DeleteFile(version);
    out = out.substring(1).split('.');
    out = [out[0] >>> 0, out[1] >>> 0];
  }
  catch (e) {
    msg = 'Could not find Node';
    msg += '\nGo to https://nodejs.org/ and install the Latest Current version';
    shell.Popup(msg, 0, 'Error', 1 << 4);
  }
  if (out[0] < 10 || (out[0] === 10 && out[1] < 4)) {
    msg = 'Your Node version is too low';
    msg += '\nGo to https://nodejs.org/ and install the Latest Current version';
    shell.Popup(msg, 0, 'Error', 1 << 4);
  }
  else {
    try {
      shell.Run('cmd /c node "' + cwd + 'update.js"', 1, true);
      shell.Run('cmd /c node "' + cwd + 'index.js"', 1, false);
    }
    catch (e) {
      shell.Popup('Unknown error while executing the proxy\n' +
      'Message: ' + e.message, 0, 'Error', 1 << 4);
    }
  }
  WScript.Quit();
@else @*/
console.log(
  'Please do not run this file with Node, but double click it instead'
);
/*@end @*/
