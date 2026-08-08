using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

public class PostBuildRestore : IPostprocessBuildWithReport
{
    public int callbackOrder => 0;

    public void OnPostprocessBuild(BuildReport report)
    {
        if (report.summary.platform != BuildTarget.WebGL) return;

        string projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        string overridesDir = Path.Combine(projectRoot, "_custom_overrides");
        string buildOutputDir = Path.GetFullPath(report.summary.outputPath);

        if (!Directory.Exists(overridesDir))
        {
            Debug.LogWarning($"[PostBuildRestore] No _custom_overrides/ folder found at: {overridesDir}\nRun Tools > Post Build Restore > Create Override Folder to set it up.");
            return;
        }

        int count = 0;
        foreach (string srcFile in Directory.GetFiles(overridesDir, "*", SearchOption.AllDirectories))
        {
            string relativePath = srcFile.Substring(overridesDir.Length + 1);
            string destFile = Path.Combine(buildOutputDir, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(destFile));
            File.Copy(srcFile, destFile, overwrite: true);
            Debug.Log($"[PostBuildRestore] Restored: {relativePath}");
            count++;
        }

        Debug.Log($"[PostBuildRestore] Done — {count} file(s) restored to build output.");
    }
}
