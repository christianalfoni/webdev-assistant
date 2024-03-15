export type ToolCallEventType = ToolCallEvent["type"];

export type ToolCallEvent = { id: string } & (
  | {
      status: "pending" | "resolved";
    }
  | {
      status: "rejected";
      error: string;
    }
) &
  (
    | {
        type: "search_code_embeddings";
        query: string;
      }
    | {
        type: "search_doc_embeddings";
        query: string;
      }
    | {
        type: "read_file";
        path: string;
      }
    | {
        type: "write_file";
        path: string;
        content: string;
      }
    | {
        type: "read_directory";
        path: string;
      }
    | {
        type: "delete_file_or_directory";
        path: string;
      }
    | {
        type: "run_terminal_command";
        command: string;
        buffer: string[];
      }
    | {
        type: "search_file_paths";
        path: string;
      }
    | {
        type: "read_development_logs";
      }
    | {
        type: "read_runtime_errors";
      }
  );
