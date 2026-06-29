using System.IO;
using UnityEditor;
using UnityEngine;

public static class PostBuildRestoreSetup
{
    private const string OverridesFolder = "_custom_overrides";

    [MenuItem("Tools/Post Build Restore/Create Override Folder")]
    public static void CreateOverrideFolder()
    {
        string projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        string overridesDir = Path.Combine(projectRoot, OverridesFolder);

        if (Directory.Exists(overridesDir))
        {
            EditorUtility.DisplayDialog("Post Build Restore",
                $"_custom_overrides/ already exists at:\n{overridesDir}", "OK");
            return;
        }

        Directory.CreateDirectory(overridesDir);

        // Create a placeholder so the folder is visible in Explorer
        File.WriteAllText(Path.Combine(overridesDir, "README.txt"),
            "Place files here that should be copied into the WebGL build output after every build.\n" +
            "Preserve the relative path from the build root — e.g.:\n" +
            "  _custom_overrides/StreamingAssets/countries.json\n" +
            "  _custom_overrides/StreamingAssets/manifest-local.json\n");

        Debug.Log($"[PostBuildRestore] Created _custom_overrides/ at: {overridesDir}");
        EditorUtility.DisplayDialog("Post Build Restore",
            $"Created _custom_overrides/ at:\n{overridesDir}\n\nAdd files there matching their relative paths from the build output root.",
            "OK");
    }

    [MenuItem("Tools/Post Build Restore/Open Override Folder")]
    public static void OpenOverrideFolder()
    {
        string projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        string overridesDir = Path.Combine(projectRoot, OverridesFolder);

        if (!Directory.Exists(overridesDir))
        {
            bool create = EditorUtility.DisplayDialog("Post Build Restore",
                "_custom_overrides/ does not exist yet. Create it?", "Create", "Cancel");
            if (create) CreateOverrideFolder();
            return;
        }

        EditorUtility.RevealInFinder(overridesDir);
    }
}
