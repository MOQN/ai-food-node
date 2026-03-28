import os

def batch_rename():
    # 获取当前运行脚本所在的文件夹路径
    current_dir = os.getcwd()
    
    # 获取当前脚本自己的名字，避免它把自身也给重命名了
    script_name = os.path.basename(__file__)
    
    # 在命令行里提示你输入想要的前缀
    prefix = input("请输入你想设置的统一前缀 (例如 'photo_'): ")
    
    # 获取当前文件夹下的所有文件和文件夹
    files = os.listdir(current_dir)
    
    count = 1
    for filename in files:
        # 排除掉脚本本身，并且只处理文件（不处理子文件夹）
        if filename == script_name or os.path.isdir(os.path.join(current_dir, filename)):
            continue
        
        # 构造新的文件名 (前缀 + 数字 + .png)
        new_name = f"{prefix}{count}.png"
        
        # 构造旧文件和新文件的完整路径
        old_path = os.path.join(current_dir, filename)
        new_path = os.path.join(current_dir, new_name)
        
        try:
            # 执行重命名操作
            os.rename(old_path, new_path)
            print(f"成功: '{filename}' -> '{new_name}'")
            count += 1
        except FileExistsError:
            print(f"跳过: 文件 '{new_name}' 已存在，请检查。")
        except Exception as e:
            print(f"错误: 无法重命名 '{filename}'，原因: {e}")

    print(f"\n批量重命名完成！共处理了 {count - 1} 个文件。")

if __name__ == "__main__":
    batch_rename()